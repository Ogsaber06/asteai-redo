import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { User } from '@asteai/types';

@ApiTags('projects')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private readonly svc: ProjectsService) {}

  @Get('open')
  findOpen(@Query('page') page = 1, @Query('pageSize') pageSize = 20) {
    return this.svc.findOpen(+page, +pageSize);
  }

  @Get('mine')
  @Roles('Buyer')
  myProjects(@CurrentUser() user: User) {
    return this.svc.findForUser(user.id, 'buyer');
  }

  @Get('assigned')
  @Roles('Freelancer')
  assigned(@CurrentUser() user: User) {
    return this.svc.findForUser(user.id, 'freelancer');
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  @Post()
  @Roles('Buyer')
  create(@Body() body: any, @CurrentUser() user: User) {
    return this.svc.create(body, user);
  }

  @Patch(':id/stage')
  @Roles('Buyer', 'Admin')
  updateStage(@Param('id') id: string, @Body() body: { stage: string }, @CurrentUser() user: User) {
    return this.svc.updateStage(id, body.stage, user);
  }

  @Patch(':id/milestones/:milestoneId')
  @Roles('Buyer', 'Freelancer', 'Admin')
  updateMilestone(
    @Param('id') id: string,
    @Param('milestoneId') mid: string,
    @Body() body: { status: string },
    @CurrentUser() user: User,
  ) {
    return this.svc.updateMilestone(id, mid, body.status, user);
  }
}
