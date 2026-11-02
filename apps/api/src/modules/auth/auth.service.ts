import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  Inject,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { DB_POOL } from '../../database/database.module';
import { RegisterDto } from './dto/register.dto';
import { User, UserRole } from '@asteai/types';

@Injectable()
export class AuthService {
  constructor(
    @Inject(DB_POOL) private readonly db: Pool,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async validateUser(email: string, password: string): Promise<User | null> {
    const { rows } = await this.db.query(
      `SELECT id, email, first_name, last_name, role, tenant_id, title,
              avatar_url, account_status, email_verified, password_hash,
              created_at, updated_at
       FROM user_accounts
       WHERE email_canonical = LOWER($1) AND account_status = 'active' AND deleted_at IS NULL`,
      [email],
    );
    if (!rows.length) return null;
    const user = rows[0];
    if (!user.password_hash) return null;
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return null;
    return this.mapRow(user);
  }

  async login(user: User) {
    const payload = { sub: user.id, role: user.role, tenantId: (user as any).tenantId };
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = uuidv4();
    const refreshHash = await bcrypt.hash(refreshToken, 10);
    const expiresAt = new Date(
      Date.now() + this.parseDuration(this.config.get('JWT_REFRESH_EXPIRES_IN', '7d')),
    );

    await this.db.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
      [user.id, refreshHash, expiresAt],
    );

    await this.db.query(
      `UPDATE user_accounts SET last_login = NOW() WHERE id = $1`,
      [user.id],
    );

    return { accessToken, refreshToken, user };
  }

  async register(dto: RegisterDto) {
    const { rows: existing } = await this.db.query(
      `SELECT id FROM user_accounts WHERE email_canonical = LOWER($1)`,
      [dto.email],
    );
    if (existing.length) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const { rows } = await this.db.query(
      `INSERT INTO user_accounts
         (email, email_canonical, first_name, last_name, role, password_hash, auth_provider)
       VALUES ($1, LOWER($1), $2, $3, $4, $5, 'local')
       RETURNING id, email, first_name, last_name, role, tenant_id, title,
                 avatar_url, account_status, email_verified, created_at, updated_at`,
      [dto.email, dto.firstName, dto.lastName, dto.role ?? 'Candidate', passwordHash],
    );

    return this.login(this.mapRow(rows[0]));
  }

  async refreshTokens(userId: string, rawToken: string) {
    const { rows } = await this.db.query(
      `SELECT id, token_hash FROM refresh_tokens
       WHERE user_id = $1 AND revoked = FALSE AND expires_at > NOW()`,
      [userId],
    );

    for (const row of rows) {
      if (await bcrypt.compare(rawToken, row.token_hash)) {
        await this.db.query(`UPDATE refresh_tokens SET revoked = TRUE WHERE id = $1`, [row.id]);
        const { rows: userRows } = await this.db.query(
          `SELECT id, email, first_name, last_name, role, tenant_id, title,
                  avatar_url, account_status, email_verified, created_at, updated_at
           FROM user_accounts WHERE id = $1`,
          [userId],
        );
        if (!userRows.length) throw new UnauthorizedException();
        return this.login(this.mapRow(userRows[0]));
      }
    }
    throw new UnauthorizedException('Invalid or expired refresh token');
  }

  async logout(userId: string) {
    await this.db.query(
      `UPDATE refresh_tokens SET revoked = TRUE
       WHERE user_id = $1 AND revoked = FALSE`,
      [userId],
    );
    await this.db.query(
      `UPDATE user_accounts SET last_logout = NOW() WHERE id = $1`,
      [userId],
    );
  }

  private mapRow(row: Record<string, unknown>): User {
    return {
      id:            row.id as string,
      email:         row.email as string,
      firstName:     row.first_name as string,
      lastName:      row.last_name as string,
      role:          row.role as UserRole,
      tenantId:      row.tenant_id as string | null,
      title:         row.title as string | undefined,
      avatarUrl:     row.avatar_url as string | undefined,
      accountStatus: row.account_status as 'active',
      emailVerified: Boolean(row.email_verified),
      createdAt:     String(row.created_at),
      updatedAt:     String(row.updated_at),
    };
  }

  private parseDuration(s: string): number {
    const unit = s.slice(-1);
    const n = parseInt(s.slice(0, -1), 10);
    return unit === 'd' ? n * 86400000 : unit === 'h' ? n * 3600000 : n * 60000;
  }
}
