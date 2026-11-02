import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { LedgerService } from './ledger.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { User } from '@asteai/types';

@ApiTags('ledger')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('ledger')
export class LedgerController {
  constructor(private readonly svc: LedgerService) {}

  @Get()
  @Roles('Employer', 'Admin')
  tenantLedger(@CurrentUser() user: User, @Query('page') page = 1) {
    if (!user.tenantId) return [];
    return this.svc.findForTenant(user.tenantId, +page);
  }

  @Get('wallet')
  @Roles('Freelancer')
  wallet(@CurrentUser() user: User) {
    return this.svc.getWallet(user.id);
  }
}
