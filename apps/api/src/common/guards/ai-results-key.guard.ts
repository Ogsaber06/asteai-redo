import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';

/**
 * Lets deeptech_ai post results: the request must carry `x-api-key` equal to
 * ASTEAI_RESULTS_KEY (set to the same value as deeptech_ai's ASTEAI_RESULTS_KEY).
 * With the key unset every request is refused, so the endpoint is closed by default.
 */
@Injectable()
export class AiResultsKeyGuard implements CanActivate {
  private readonly logger = new Logger(AiResultsKeyGuard.name);

  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.get<string>('ASTEAI_RESULTS_KEY') ?? '';
    const got = String(context.switchToHttp().getRequest().headers['x-api-key'] ?? '');
    if (!expected) {
      this.logger.error('ASTEAI_RESULTS_KEY is not set; refusing AI result posts');
      throw new UnauthorizedException();
    }
    const a = Buffer.from(got);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new UnauthorizedException();
    return true;
  }
}
