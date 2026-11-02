import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { User } from '@asteai/types';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('Admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly svc: AdminService) {}

  @Get('stats')
  stats() { return this.svc.getMasterStats(); }

  @Get('audit')
  audit(@Query('page') page = 1, @Query('pageSize') pageSize = 50) {
    return this.svc.getAuditLog(+page, +pageSize);
  }

  @Post('flags')
  setFlag(@Body() body: { name: string; value: boolean }, @CurrentUser() user: User) {
    return this.svc.setFeatureFlag(body.name, body.value, user.id);
  }
}
