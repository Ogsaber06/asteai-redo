import {
  BadRequestException, Body, Controller, ForbiddenException, Get, Inject, Injectable, Logger, Module, NotFoundException,
  Optional, Param, ParseUUIDPipe, Post, Query, Res, ServiceUnavailableException, UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
import { randomUUID } from 'crypto';
import type { Response } from 'express';
import { Pool } from 'pg';
import {
  DELIVERABLE_MAX_BYTES, DELIVERABLE_TYPES, type DeliverableFile, type DeliverableUploadTicket, type User,
} from '@asteai/types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { DB_POOL } from '../../database/database.module';
import { AwsCredentialProvider, presignS3Url, type AwsCredentials } from '../resumes/s3-presign';

export const DELIVERABLE_STORAGE = 'DELIVERABLE_STORAGE';
export interface DeliverableStorage { bucket: string; region: string; credentials: () => Promise<AwsCredentials> }

export class DeliverableUploadDto {
  /** A gig order (its contract is used), or a contract + milestone. */
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(32) orderId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(32) contractId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() milestoneId?: string;
  @ApiProperty() @IsString() @MinLength(3) @MaxLength(200) fileName!: string;
  @ApiProperty() @IsString() @MaxLength(120) contentType!: string;
  @ApiProperty() @IsInt() @Min(1) @Max(DELIVERABLE_MAX_BYTES) sizeBytes!: number;
}

/** File name and type checks (deliverables.spec.ts). Returns the canonical MIME type or an error. */
export function checkDeliverable(fileName: string, contentType: string, sizeBytes: number): { contentType: string } | { error: string } {
  const ext = fileName.toLowerCase().split('.').pop() ?? '';
  const mime = DELIVERABLE_TYPES[ext];
  if (!mime || ext === fileName.toLowerCase()) return { error: `.${ext} files aren't accepted; use PDF, ZIP, images, Office documents, text or MP4` };
  // Browsers report some types inconsistently (e.g. zip as application/x-zip-compressed); the extension decides.
  if (contentType && contentType !== mime && !(ext === 'zip' && /zip/.test(contentType)) && contentType !== 'application/octet-stream') {
    return { error: `That file says it is ${contentType}, not .${ext}` };
  }
  if (sizeBytes < 1) return { error: 'The file is empty' };
  if (sizeBytes > DELIVERABLE_MAX_BYTES) return { error: 'Files are limited to 50 MB' };
  return { contentType: mime };
}

/** `report (final).pdf` → `report_final_.pdf`: safe as an S3 key segment and a download name. */
export const safeFileName = (name: string) => name.normalize('NFKD').replace(/[^\w.-]+/g, '_').replace(/_+/g, '_').slice(-120);

interface FileRow {
  id: string; uploaded_by: string; order_id: string | null; contract_id: string; milestone_id: string | null;
  object_key: string; file_name: string; content_type: string; size_bytes: string | number; created_at: Date;
}

const mapFile = (r: FileRow): DeliverableFile => ({
  id: r.id, fileName: r.file_name, contentType: r.content_type, sizeBytes: Number(r.size_bytes), milestoneId: r.milestone_id,
  orderId: r.order_id, uploadedBy: r.uploaded_by, createdAt: new Date(r.created_at).toISOString(),
  downloadPath: `/api/v1/deliverables/${r.id}/download`,
});

/**
 * Deliverable files for gig orders and contract milestones. Only the expert on the work
 * uploads; the buyer, the expert and admins download (via a 60-second signed S3 link).
 */
@Injectable()
export class DeliverablesService {
  private readonly logger = new Logger(DeliverablesService.name);

  constructor(
    @Inject(DB_POOL) private readonly db: Pool,
    @Optional() @Inject(DELIVERABLE_STORAGE) private readonly storage: DeliverableStorage | null,
  ) {}

  private requireStorage() {
    if (!this.storage) throw new ServiceUnavailableException('File uploads are not configured (DELIVERABLE_BUCKET)');
    return this.storage;
  }

  /** The contract (and parties) a request refers to. */
  private async resolve(input: { orderId?: string; contractId?: string; milestoneId?: string }) {
    if (input.orderId) {
      const { rows } = await this.db.query<{ contract_id: string | null; buyer_id: string; expert_id: string; milestone_id: string | null }>(
        `SELECT o.contract_id, o.buyer_id, o.expert_id,
                (SELECT m.id FROM contract_milestones m WHERE m.contract_id = o.contract_id ORDER BY m.seq LIMIT 1) AS milestone_id
           FROM gig_orders o WHERE o.id = $1`, [input.orderId],
      );
      const o = rows[0];
      if (!o?.contract_id) throw new NotFoundException('Order not found');
      return { contractId: o.contract_id, milestoneId: o.milestone_id, orderId: input.orderId, buyerId: o.buyer_id, expertId: o.expert_id };
    }
    if (!input.contractId) throw new BadRequestException('Give an orderId, or a contractId');
    const { rows } = await this.db.query<{ buyer_id: string; expert_id: string }>(
      `SELECT buyer_id, expert_id FROM contracts WHERE id = $1`, [input.contractId],
    );
    if (!rows.length) throw new NotFoundException('Contract not found');
    if (input.milestoneId) {
      const { rows: ms } = await this.db.query(`SELECT 1 FROM contract_milestones WHERE id = $1 AND contract_id = $2`, [input.milestoneId, input.contractId]);
      if (!ms.length) throw new NotFoundException('Milestone not found');
    }
    return { contractId: input.contractId, milestoneId: input.milestoneId ?? null, orderId: null, buyerId: rows[0].buyer_id, expertId: rows[0].expert_id };
  }

  async createUpload(user: User, dto: DeliverableUploadDto): Promise<DeliverableUploadTicket> {
    const storage = this.requireStorage();
    const checked = checkDeliverable(dto.fileName, dto.contentType, dto.sizeBytes);
    if ('error' in checked) throw new BadRequestException(checked.error);
    const target = await this.resolve(dto);
    if (target.expertId !== user.id) throw new ForbiddenException('Only the expert on this work uploads deliverables');

    const id = randomUUID();
    const key = `deliverables/${target.contractId}/${id}/${safeFileName(dto.fileName)}`;
    const { rows } = await this.db.query<FileRow>(
      `INSERT INTO deliverable_files (id, uploaded_by, order_id, contract_id, milestone_id, object_key, file_name, content_type, size_bytes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [id, user.id, target.orderId, target.contractId, target.milestoneId, key, dto.fileName.slice(0, 200), checked.contentType, dto.sizeBytes],
    );
    const headers = { 'Content-Type': checked.contentType };
    const url = presignS3Url({
      method: 'PUT', bucket: storage.bucket, region: storage.region, key, expiresInSeconds: 600, credentials: await storage.credentials(),
      signedHeaders: { 'content-type': checked.contentType, 'content-length': String(dto.sizeBytes) },
    });
    return { file: mapFile(rows[0]), url, method: 'PUT', headers, expiresInSeconds: 600 };
  }

  async list(user: User, q: { orderId?: string; contractId?: string }): Promise<DeliverableFile[]> {
    const target = await this.resolve({ orderId: q.orderId, contractId: q.contractId });
    if (![target.buyerId, target.expertId].includes(user.id) && user.role !== 'Admin') throw new ForbiddenException();
    const { rows } = await this.db.query<FileRow>(
      `SELECT * FROM deliverable_files WHERE contract_id = $1 ORDER BY created_at DESC LIMIT 200`, [target.contractId],
    );
    return rows.map(mapFile);
  }

  /** A short-lived signed S3 URL that downloads the file under its original name. */
  async downloadUrl(user: User, id: string): Promise<string> {
    const storage = this.requireStorage();
    const { rows } = await this.db.query<FileRow & { buyer_id: string; expert_id: string }>(
      `SELECT f.*, c.buyer_id, c.expert_id FROM deliverable_files f JOIN contracts c ON c.id = f.contract_id WHERE f.id = $1`, [id],
    );
    const f = rows[0];
    if (!f) throw new NotFoundException('File not found');
    if (![f.buyer_id, f.expert_id].includes(user.id) && user.role !== 'Admin') throw new ForbiddenException();
    return presignS3Url({
      method: 'GET', bucket: storage.bucket, region: storage.region, key: f.object_key, expiresInSeconds: 60,
      credentials: await storage.credentials(),
      query: { 'response-content-disposition': `attachment; filename="${safeFileName(f.file_name)}"` },
    });
  }
}

@ApiTags('deliverables')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('deliverables')
export class DeliverablesController {
  constructor(private readonly svc: DeliverablesService) {}

  @Post('upload-url')
  @Throttle({ short: { ttl: 60_000, limit: 20 } })
  @ApiOperation({ summary: 'Presigned S3 PUT for a deliverable file (expert on the order/contract; ≤ 50 MB)' })
  upload(@CurrentUser() user: User, @Body() dto: DeliverableUploadDto) {
    return this.svc.createUpload(user, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Deliverable files of an order (?orderId=) or a contract (?contractId=)' })
  list(@CurrentUser() user: User, @Query('orderId') orderId?: string, @Query('contractId') contractId?: string) {
    return this.svc.list(user, { orderId, contractId });
  }

  /** Redirects a party to a 60-second signed download link. */
  @Get(':id/download')
  async download(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    res.redirect(302, await this.svc.downloadUrl(user, id));
  }
}

@Module({
  controllers: [DeliverablesController],
  providers: [
    DeliverablesService,
    {
      provide: DELIVERABLE_STORAGE,
      inject: [ConfigService],
      useFactory: (config: ConfigService): DeliverableStorage | null => {
        const bucket = config.get<string>('DELIVERABLE_BUCKET') || config.get<string>('RESUME_BUCKET');
        const region = config.get<string>('DELIVERABLE_BUCKET_REGION') || config.get<string>('RESUME_BUCKET_REGION') || config.get<string>('AWS_REGION');
        if (!bucket || !region) {
          new Logger('DeliverablesModule').warn('DELIVERABLE_BUCKET not set: deliverable uploads are disabled');
          return null;
        }
        const provider = new AwsCredentialProvider((k) => config.get<string>(k) ?? process.env[k]);
        return { bucket, region, credentials: () => provider.get() };
      },
    },
  ],
})
export class DeliverablesModule {}
