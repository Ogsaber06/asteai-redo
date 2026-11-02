import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PassportsService } from './passports.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '@asteai/types';

@ApiTags('passports')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('passports')
export class PassportsController {
  constructor(private readonly svc: PassportsService) {}

  @Get('me')
  myPassports(@CurrentUser() user: User) {
    return this.svc.findForUser(user.id);
  }

  @Get('verify')
  verify(@Query('hash') hash: string) {
    return this.svc.verify(hash);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.svc.findById(id);
  }

  @Patch(':id/share')
  updateShare(
    @Param('id') id: string,
    @Body() body: { discoverable: boolean; showIdentity: boolean },
  ) {
    return this.svc.updateShare(id, body);
  }

  @Post(':id/verify')
  addVerification(@Param('id') id: string, @CurrentUser() user: User) {
    return this.svc.addVerification(id, user.firstName + ' ' + user.lastName);
  }
}
