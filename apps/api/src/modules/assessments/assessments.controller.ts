import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AssessmentsService } from './assessments.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { User } from '@asteai/types';

@ApiTags('assessments')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('assessments')
export class AssessmentsController {
  constructor(private readonly svc: AssessmentsService) {}

  @Post('submit')
  @Roles('Candidate')
  submit(@Body() body: any, @CurrentUser() user: User) {
    return this.svc.submitResult({ ...body, candidateId: user.id });
  }

  @Get('result/:id')
  findResult(@Param('id') id: string) {
    return this.svc.findResult(id);
  }

  @Get('integrity-queue')
  @Roles('Admin')
  integrityQueue(@CurrentUser() user: User) {
    return this.svc.getIntegrityQueue(user);
  }

  @Patch('integrity-queue/:id/resolve')
  @Roles('Admin')
  resolve(
    @Param('id') id: string,
    @Body() body: { resolution: string },
    @CurrentUser() user: User,
  ) {
    return this.svc.resolveIntegrity(id, body.resolution, user.id);
  }
}
