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
  // ==========================================

  @Get('monitoring/system')
  @UseGuards(JwtAuthGuard)
  async getSystemResources() {
    const resources = await this.mikrotikService.getSystemResources();
    return ApiResponseDto.success('System resources retrieved', resources);
  }

  @Get('monitoring/sessions')
  @UseGuards(JwtAuthGuard)
  async getSessionsStats() {
    const stats = await this.mikrotikService.getActiveSessionsStats();
    return ApiResponseDto.success('Active sessions statistics retrieved', stats);
  }

  @Get('monitoring/interface')
  @UseGuards(JwtAuthGuard)
  async getInterfaceStats() {
    const stats = await this.mikrotikService.getInterfaceStats('ether1');
    return ApiResponseDto.success('Interface statistics retrieved', stats);
  }

  @Get('monitoring/hotspot')
  @UseGuards(JwtAuthGuard)
  async getHotspotStats() {
    const stats = await this.mikrotikService.getHotspotStats();
    return ApiResponseDto.success('Hotspot statistics retrieved', stats);
  }

  @Get('monitoring/dashboard')
  @UseGuards(JwtAuthGuard)
  async getMonitoringDashboard() {
    const dashboard = await this.mikrotikService.getMonitoringDashboard();
    return ApiResponseDto.success('Monitoring dashboard data retrieved', dashboard);
  }
}
