import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { MikrotikService } from './mikrotik.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { ApiResponseDto } from '@/common/dto/api-response.dto';

@Controller('mikrotik')
export class MikrotikController {
  constructor(private readonly mikrotikService: MikrotikService) {}

  @Get('status')
  @UseGuards(JwtAuthGuard)
  async getStatus() {
    const isConnected = this.mikrotikService.getConnectionStatus();
    return ApiResponseDto.success(
      isConnected ? 'Connected to Mikrotik' : 'Not connected',
      { isConnected },
    );
  }

  @Post('connect')
  @UseGuards(JwtAuthGuard)
  async connect() {
    const connected = await this.mikrotikService.connect();
    return ApiResponseDto.success(
      connected ? 'Connected successfully' : 'Connection failed',
      { connected },
    );
  }

  @Get('users')
  @UseGuards(JwtAuthGuard)
  async getUsers() {
    const users = await this.mikrotikService.getHotspotUsers();
    return ApiResponseDto.success('Hotspot users retrieved', users);
  }

  @Get('active-sessions')
  @UseGuards(JwtAuthGuard)
  async getActiveSessions() {
    const sessions = await this.mikrotikService.getActiveSessions();
    return ApiResponseDto.success('Active sessions retrieved', sessions);
  }

  @Get('profiles')
  @UseGuards(JwtAuthGuard)
  async getProfiles() {
    const profiles = await this.mikrotikService.getHotspotProfiles();
    return ApiResponseDto.success('Hotspot profiles retrieved', profiles);
  }

  @Post('disconnect')
  @UseGuards(JwtAuthGuard)
  async disconnectUser(@Body('username') username: string) {
    await this.mikrotikService.disconnectUser(username);
    return ApiResponseDto.success('User disconnected successfully');
  }

  // ==========================================
  // PHASE 4: MONITORING ENDPOINTS
  // Live monitoring dinonaktifkan (arsitektur Direct RADIUS tanpa API).
  // Dashboard admin membaca data dari DB (RADIUS accounting).
  // ==========================================

  @Get('monitoring/system')
  @UseGuards(JwtAuthGuard)
  async getSystemResources() {
    return ApiResponseDto.success('Live monitoring dinonaktifkan', null);
  }

  @Get('monitoring/sessions')
  @UseGuards(JwtAuthGuard)
  async getSessionsStats() {
    return ApiResponseDto.success('Live monitoring dinonaktifkan', null);
  }

  @Get('monitoring/interface')
  @UseGuards(JwtAuthGuard)
  async getInterfaceStats() {
    return ApiResponseDto.success('Live monitoring dinonaktifkan', null);
  }

  @Get('monitoring/hotspot')
  @UseGuards(JwtAuthGuard)
  async getHotspotStats() {
    return ApiResponseDto.success('Live monitoring dinonaktifkan', null);
  }

  @Get('monitoring/dashboard')
  @UseGuards(JwtAuthGuard)
  async getMonitoringDashboard() {
    return ApiResponseDto.success('Live monitoring dinonaktifkan', null);
  }
}
