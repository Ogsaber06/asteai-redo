import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@asteai/types';

export const ROLES_KEY = 'roles';

/**
 * Restrict an endpoint to one or more roles.
 * Usage: @Roles('Admin', 'Employer')
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
