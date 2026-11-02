import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { DB_POOL } from '../../../database/database.module';

interface JwtPayload {
  sub: string;
  role: string;
  tenantId: string | null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    @Inject(DB_POOL) private readonly db: Pool,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.getOrThrow('JWT_SECRET'),
      ignoreExpiration: false,
    });
  }

  async validate(payload: JwtPayload) {
    const { rows } = await this.db.query(
      `SELECT id, email, first_name, last_name, role, tenant_id, title,
              avatar_url, account_status, email_verified, created_at, updated_at
       FROM user_accounts WHERE id = $1 AND account_status = 'active' AND deleted_at IS NULL`,
      [payload.sub],
    );
    if (!rows.length) throw new UnauthorizedException();
    const u = rows[0];
    return {
      id:            u.id,
      email:         u.email,
      firstName:     u.first_name,
      lastName:      u.last_name,
      role:          u.role,
      tenantId:      u.tenant_id,
      title:         u.title,
      avatarUrl:     u.avatar_url,
      accountStatus: u.account_status,
      emailVerified: Boolean(u.email_verified),
      createdAt:     String(u.created_at),
      updatedAt:     String(u.updated_at),
    };
  }
}
