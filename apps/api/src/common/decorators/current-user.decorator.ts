import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from '@asteai/types';

/**
 * Extracts the authenticated user from `request.user`.
 * Usage: @CurrentUser() user: User
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): User => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
