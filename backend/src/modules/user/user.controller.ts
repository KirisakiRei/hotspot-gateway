import {
  Controller,
  Get,
  Put,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { UserService } from './user.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { UserStatus } from '@prisma/client';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @Roles('SUPER_ADMIN', 'ADMIN', 'OPERATOR')
  async getUsers(
    @Query('status') status?: UserStatus,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.userService.findAll({
      status,
      search,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
  }

  @Get('stats')
  @Roles('SUPER_ADMIN', 'ADMIN', 'OPERATOR')
  async getStats() {
    return this.userService.getStats();
  }

  @Get('online')
  @Roles('SUPER_ADMIN', 'ADMIN', 'OPERATOR')
  async getOnlineUsers() {
    return this.userService.findOnlineUsers();
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'OPERATOR')
  async getUserById(@Param('id') id: string) {
    return this.userService.findById(id);
  }

  @Put(':id/kick')
  @Roles('SUPER_ADMIN', 'ADMIN', 'OPERATOR')
  async kickUser(@Param('id') id: string) {
    return this.userService.kickUser(id);
  }

  @Put(':id/block')
  @Roles('SUPER_ADMIN', 'ADMIN')
  async blockUser(
    @Param('id') id: string,
    @Body('reason') reason?: string,
  ) {
    return this.userService.blockUser(id, reason);
  }

  @Put(':id/unblock')
  @Roles('SUPER_ADMIN', 'ADMIN')
  async unblockUser(@Param('id') id: string) {
    return this.userService.unblockUser(id);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  async deleteUser(@Param('id') id: string) {
    return this.userService.deleteUser(id);
  }
}
