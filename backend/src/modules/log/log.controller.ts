import {
  Controller,
  Get,
  Delete,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { LogService } from './log.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';

@Controller('logs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LogController {
  constructor(private readonly logService: LogService) {}

  @Get()
  @Roles('SUPER_ADMIN', 'ADMIN')
  async getLogs(
    @Query('action') action?: string,
    @Query('type') type?: string,
    @Query('adminId') adminId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.logService.findAll({
      action,
      type,
      adminId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
  }

  @Get('actions')
  @Roles('SUPER_ADMIN', 'ADMIN')
  async getActions() {
    return this.logService.getActions();
  }

  @Get('entities')
  @Roles('SUPER_ADMIN', 'ADMIN')
  async getEntities() {
    return this.logService.getEntities();
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  async getLogById(@Param('id') id: string) {
    return this.logService.findById(id);
  }

  @Delete('cleanup')
  @Roles('SUPER_ADMIN')
  async cleanupOldLogs(@Query('days') days?: string) {
    const daysToKeep = days ? parseInt(days) : 90;
    return this.logService.deleteOldLogs(daysToKeep);
  }
}
