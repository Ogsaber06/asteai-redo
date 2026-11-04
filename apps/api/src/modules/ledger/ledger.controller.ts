import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { LedgerService } from './ledger.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { User } from '@asteai/types';
import { paginate } from '../../common/utils/pagination';

@ApiTags('ledger')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('ledger')
export class LedgerController {
  constructor(private readonly svc: LedgerService) {}

  @Get()
  @Roles('Employer', 'Admin')
  tenantLedger(@CurrentUser() user: User, @Query('page') page?: string) {
    if (!user.tenantId) return [];
    const { pageSize, offset } = paginate(page, 50, 50);
    return this.svc.findForTenant(user.tenantId, pageSize, offset);
  }

  @Get('wallet')
  @Roles('Freelancer', 'Buyer', 'Admin')
  wallet(@CurrentUser() user: User) {
    return this.svc.getWallet(user.id);
  }

  @Get('entries')
  userEntries(@CurrentUser() user: User) {
    return this.svc.findForUser(user.id);
  }

  @Post('deposit')
  deposit(@CurrentUser() user: User, @Body() body: { amount: number; description?: string }) {
    return this.svc.record({
      userId: user.id,
      tenantId: user.tenantId ?? undefined,
      type: 'Deposit',
      description: body.description ?? 'Wallet deposit',
      amount: Math.abs(body.amount),
      by: `${user.firstName} ${user.lastName}`,
    });
  }
}
