import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CertificatesService } from './certificates.service';

/** Public: what a QR code or the "Verified online at" link resolves to. */
@ApiTags('certificates')
@Controller('certificates')
export class CertificatesController {
  constructor(private readonly svc: CertificatesService) {}

  @Get('verify/:id')
  verify(@Param('id') id: string) {
    return this.svc.verify(id);
  }
}
