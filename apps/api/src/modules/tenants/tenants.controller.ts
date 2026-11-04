import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { TenantsService } from './tenants.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@ApiTags('tenants')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('tenants')
export class TenantsController {
  constructor(private readonly svc: TenantsService) {}

  @Get()
  @Roles('Admin')
  findAll() { return this.svc.findAll(); }

  @Get(':id')
  @Roles('Admin', 'Employer')
  findOne(@Param('id') id: string) { return this.svc.findOne(id); }

  @Get(':id/team')
  @Roles('Admin', 'Employer')
  getTeam(@Param('id') id: string) {
    return this.svc.getTeam(id);
  }

  @Post(':id/team')
  @Roles('Admin', 'Employer')
  addTeamMember(
    @Param('id') id: string,
    @Body() body: { email: string; firstName: string; lastName: string; role: string; title?: string },
  ) {
    return this.svc.addTeamMember(id, body);
  }

  @Get(':id/pools')
  @Roles('Admin', 'Employer')
  getPools(@Param('id') id: string) {
    return this.svc.getPools(id);
  }

  @Post(':id/pools')
  @Roles('Admin', 'Employer')
  createPool(
    @Param('id') id: string,
    @Body() body: { name: string; count?: number; tags?: string[] },
  ) {
    return this.svc.createPool(id, body);
  }

  @Get(':id/outreach')
  @Roles('Admin', 'Employer')
  getOutreach(@Param('id') id: string) {
    return this.svc.getOutreach(id);
  }

  @Post(':id/outreach')
  @Roles('Admin', 'Employer')
  createOutreach(
    @Param('id') id: string,
    @Body() body: { name: string; channel: string; sent?: number },
  ) {
    return this.svc.createOutreach(id, body);
  }

  @Post(':id/credits')
  @Roles('Admin', 'Employer')
  topUpCredits(
    @Param('id') id: string,
    @Body() body: { amount: number },
  ) {
    return this.svc.updateCredits(id, body.amount);
  }
}
