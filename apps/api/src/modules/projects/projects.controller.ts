import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { User } from '@asteai/types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { paginate } from '../../common/utils/pagination';
import { CreateProjectDto, UpdateMilestoneDto, UpdateProjectStageDto } from './dto/project.dto';
import { ProjectsService } from './projects.service';

@ApiTags('projects')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private readonly svc: ProjectsService) {}

  @Get('open')
  findOpen(@Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.svc.findOpen(paginate(page, pageSize));
  }

  @Get('services')
  findServices() {
    return this.svc.findServices();
  }

  @Get('experts')
  findExperts() {
    return this.svc.findExperts();
  }

  @Get('disputes')
  findDisputes(@CurrentUser() user: User) {
    return this.svc.findDisputes(user);
  }

  @Post('disputes')
  createDispute(
    @Body() body: { projectId?: string; raisedAgainst: string; reason: string },
    @CurrentUser() user: User,
  ) {
    return this.svc.createDispute(body, user);
  }

  @Patch('disputes/:id/resolve')
  @Roles('Admin')
  resolveDispute(@Param('id') id: string, @Body() body: { resolution: string }) {
    return this.svc.resolveDispute(id, body.resolution);
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
  create(@Body() body: CreateProjectDto, @CurrentUser() user: User) {
    return this.svc.create(body, user);
  }

  @Patch(':id/stage')
  @Roles('Buyer', 'Admin')
  updateStage(@Param('id') id: string, @Body() body: UpdateProjectStageDto, @CurrentUser() user: User) {
    return this.svc.updateStage(id, body.stage, user);
  }

  @Patch(':id/milestones/:milestoneId')
  @Roles('Buyer', 'Freelancer', 'Admin')
  updateMilestone(
    @Param('id') id: string,
    @Param('milestoneId') milestoneId: string,
    @Body() body: UpdateMilestoneDto,
    @CurrentUser() user: User,
  ) {
    return this.svc.updateMilestone(id, milestoneId, body.status, user);
  }
}
