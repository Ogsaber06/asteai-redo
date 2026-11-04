import { ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { Pool } from 'pg';
import type { User } from '@asteai/types';
import { DB_POOL } from '../../database/database.module';
import { isUniqueViolation } from '../../common/utils/pg-errors';
import { mapUserRow, USER_COLUMNS, UserRow } from '../users/user.mapper';
import { RegisterDto } from './dto/register.dto';
import type { JwtPayload } from './strategies/jwt.strategy';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: User;
}

const PASSWORD_ROUNDS = 12;
const REFRESH_TOKEN_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    @Inject(DB_POOL) private readonly db: Pool,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async validateUser(email: string, password: string): Promise<User | null> {
    const { rows } = await this.db.query<UserRow & { password_hash: string | null }>(
      `SELECT ${USER_COLUMNS}, password_hash
         FROM user_accounts
        WHERE email_canonical = LOWER($1) AND account_status = 'active' AND deleted_at IS NULL`,
      [email],
    );
    const row = rows[0];
    if (!row?.password_hash) return null;
    const valid = await bcrypt.compare(password, row.password_hash);
    return valid ? mapUserRow(row) : null;
  }

  /**
   * Issues an access token and a single-use refresh token.
   * The refresh token is `<row id>.<secret>`: the id finds the row directly, so a
   * refresh costs one bcrypt compare instead of one per outstanding token.
   */
  async login(user: User): Promise<AuthTokens> {
    const payload: JwtPayload = { sub: user.id, role: user.role, tenantId: user.tenantId };
    const accessToken = this.jwtService.sign(payload);

    const secret = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + parseDuration(this.config.get('JWT_REFRESH_EXPIRES_IN', '7d')));
    const { rows } = await this.db.query<{ id: string }>(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3) RETURNING id`,
      [user.id, await bcrypt.hash(secret, REFRESH_TOKEN_ROUNDS), expiresAt],
    );
    await this.db.query(`UPDATE user_accounts SET last_login = NOW() WHERE id = $1`, [user.id]);

    return { accessToken, refreshToken: `${rows[0].id}.${secret}`, user };
  }

  async register(dto: RegisterDto): Promise<AuthTokens> {
    const passwordHash = await bcrypt.hash(dto.password, PASSWORD_ROUNDS);
    try {
      const { rows } = await this.db.query<UserRow>(
        `INSERT INTO user_accounts
           (email, email_canonical, first_name, last_name, role, password_hash, auth_provider)
         SELECT $1::text, LOWER($1::text), $2::text, $3::text, $4::user_role_enum, $5::text, 'local'
          WHERE NOT EXISTS (SELECT 1 FROM user_accounts WHERE email_canonical = LOWER($1::text))
         RETURNING ${USER_COLUMNS}`,
        [dto.email, dto.firstName, dto.lastName, dto.role ?? 'Candidate', passwordHash],
      );
      if (!rows.length) throw new ConflictException('Email already registered');
      return this.login(mapUserRow(rows[0]));
    } catch (err) {
      // Two concurrent sign-ups with the same address: the UNIQUE(email) index catches the loser.
      if (isUniqueViolation(err)) throw new ConflictException('Email already registered');
      throw err;
    }
  }

  async refreshTokens(userId: string, rawToken: string): Promise<AuthTokens> {
    const [tokenId, secret] = rawToken.split('.', 2);
    if (!tokenId || !secret) throw new UnauthorizedException('Invalid or expired refresh token');

    const { rows } = await this.db.query<{ token_hash: string }>(
      `SELECT token_hash FROM refresh_tokens
        WHERE id::text = $1 AND user_id = $2 AND revoked = FALSE AND expires_at > NOW()`,
      [tokenId, userId],
    );
    if (!rows.length || !(await bcrypt.compare(secret, rows[0].token_hash))) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Single use: only the request that flips `revoked` may continue.
    const revoked = await this.db.query(
      `UPDATE refresh_tokens SET revoked = TRUE WHERE id::text = $1 AND revoked = FALSE`,
      [tokenId],
    );
    if (!revoked.rowCount) throw new UnauthorizedException('Invalid or expired refresh token');

    const { rows: userRows } = await this.db.query<UserRow>(
      `SELECT ${USER_COLUMNS} FROM user_accounts
        WHERE id = $1 AND account_status = 'active' AND deleted_at IS NULL`,
      [userId],
    );
    if (!userRows.length) throw new UnauthorizedException();
    return this.login(mapUserRow(userRows[0]));
  }

  async logout(userId: string): Promise<void> {
    await this.db.query(
      `UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = $1 AND revoked = FALSE`,
      [userId],
    );
    await this.db.query(`UPDATE user_accounts SET last_logout = NOW() WHERE id = $1`, [userId]);
  }
}

/** Parses durations such as `15m`, `12h`, `7d` (as used by JWT_*_EXPIRES_IN) into milliseconds. */
export function parseDuration(value: string): number {
  const match = /^(\d+)\s*([smhd])$/.exec(value.trim());
  if (!match) throw new Error(`Invalid duration "${value}" (expected e.g. 15m, 12h, 7d)`);
  const unit = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 }[match[2] as 's' | 'm' | 'h' | 'd'];
  return Number(match[1]) * unit;
}
