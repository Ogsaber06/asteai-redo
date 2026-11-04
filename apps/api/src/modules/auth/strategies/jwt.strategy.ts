import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Pool } from 'pg';
import type { User, UserRole } from '@asteai/types';
import { DB_POOL } from '../../../database/database.module';
import { mapUserRow, USER_COLUMNS, UserRow } from '../../users/user.mapper';

export interface JwtPayload {
  sub: string;
  role: UserRole;
  tenantId: string | null;
}

/** Validates the bearer access token and loads the (still active) user onto `request.user`. */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    @Inject(DB_POOL) private readonly db: Pool,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
      ignoreExpiration: false,
    });
  }

  async validate(payload: JwtPayload): Promise<User> {
    const { rows } = await this.db.query<UserRow>(
      `SELECT ${USER_COLUMNS} FROM user_accounts
        WHERE id = $1 AND account_status = 'active' AND deleted_at IS NULL`,
      [payload.sub],
    );
    if (!rows.length) throw new UnauthorizedException();
    return mapUserRow(rows[0]);
  }
}
