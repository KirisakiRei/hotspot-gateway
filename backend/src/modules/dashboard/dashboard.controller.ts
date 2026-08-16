import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @Roles('SUPER_ADMIN', 'ADMIN', 'OPERATOR')
  async getStats() {
    return this.dashboardService.getStats();
  }

  @Get('recent-users')
  @Roles('SUPER_ADMIN', 'ADMIN', 'OPERATOR')
  async getRecentUsers(@Query('limit') limit?: string) {
    return this.dashboardService.getRecentUsers(
      limit ? parseInt(limit) : undefined,
    );
  }

  @Get('recent-vouchers')
  @Roles('SUPER_ADMIN', 'ADMIN', 'OPERATOR')
  async getRecentVouchers(@Query('limit') limit?: string) {
    return this.dashboardService.getRecentVouchers(
      limit ? parseInt(limit) : undefined,
    );
  }

  @Get('recent-logs')
  @Roles('SUPER_ADMIN', 'ADMIN')
  async getRecentLogs(@Query('limit') limit?: string) {
    return this.dashboardService.getRecentLogs(
      limit ? parseInt(limit) : undefined,
    );
  }

  @Get('top-advertisements')
  @Roles('SUPER_ADMIN', 'ADMIN', 'OPERATOR')
  async getTopAdvertisements(@Query('limit') limit?: string) {
    return this.dashboardService.getTopAdvertisements(
      limit ? parseInt(limit) : undefined,
    );
  }
}
