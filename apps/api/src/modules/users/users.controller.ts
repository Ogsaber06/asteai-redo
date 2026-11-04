import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '@asteai/types';
import { UpdateProfileDto } from './dto/update-profile.dto';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('users')
export class UsersController {
  constructor(private readonly svc: UsersService) {}

  @Get('me')
  getMe(@CurrentUser() user: User) {
    return this.svc.findById(user.id);
  }

  @Put('me')
  updateMe(@CurrentUser() user: User, @Body() body: UpdateProfileDto) {
    return this.svc.updateProfile(user.id, body);
  }
}
