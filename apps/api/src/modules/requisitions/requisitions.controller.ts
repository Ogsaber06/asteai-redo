import {
  Controller, Get, Post, Put, Patch, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RequisitionsService } from './requisitions.service';
import { CreateRequisitionDto } from './dto/create-requisition.dto';
import { UpdateRequisitionDto } from './dto/update-requisition.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { User } from '@asteai/types';

@ApiTags('requisitions')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('requisitions')
export class RequisitionsController {
  constructor(private readonly svc: RequisitionsService) {}

  @Get()
  @Roles('Employer', 'Admin')
  @ApiOperation({ summary: 'List requisitions (scoped to tenant)' })
  findAll(
    @CurrentUser() user: User,
    @Query('status') status?: string,
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 20,
  ) {
    return this.svc.findAll(user, { status, page: +page, pageSize: +pageSize });
  }

  @Get(':id')
  @Roles('Employer', 'Admin')
  @ApiOperation({ summary: 'Get a single requisition' })
  findOne(@Param('id') id: string, @CurrentUser() user: User) {
    return this.svc.findOne(id, user);
  }

  @Post()
  @Roles('Employer', 'Admin')
  @ApiOperation({ summary: 'Create a requisition' })
  create(@Body() dto: CreateRequisitionDto, @CurrentUser() user: User) {
    return this.svc.create(dto, user);
  }

  @Put(':id')
  @Roles('Employer', 'Admin')
  @ApiOperation({ summary: 'Update a requisition' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateRequisitionDto,
    @CurrentUser() user: User,
  ) {
    return this.svc.update(id, dto, user);
  }

  @Patch(':id/fund')
  @Roles('Employer', 'Admin')
  @ApiOperation({ summary: 'Fund SLA and activate a requisition' })
  fund(@Param('id') id: string, @CurrentUser() user: User) {
    return this.svc.fundSla(id, user);
  }
}
