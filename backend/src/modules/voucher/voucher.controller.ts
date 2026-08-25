import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { VoucherService } from './voucher.service';
import {
  CreateVoucherProfileDto,
  UpdateVoucherProfileDto,
} from './dto/voucher-profile.dto';
import {
  GenerateVoucherDto,
  RequestVoucherDto,
  RedeemVoucherDto,
  ClaimFreeVoucherDto,
} from './dto/voucher.dto';
import {
  AuthenticateVoucherDto,
  DisconnectDto,
} from './dto/authenticate-voucher.dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { Public } from '@/common/decorators/public.decorator';
import { Throttle } from '@nestjs/throttler';
import { ApiResponseDto } from '@/common/dto/api-response.dto';
import { AdminRole, VoucherStatus } from '@prisma/client';

@Controller('vouchers')
export class VoucherController {
  constructor(private readonly voucherService: VoucherService) {}

  // ==========================================
  // VOUCHER PROFILES (Admin only)
  // ==========================================

  @Post('profiles')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  async createProfile(@Body() createDto: CreateVoucherProfileDto) {
    const profile = await this.voucherService.createProfile(createDto);
    return ApiResponseDto.success('Voucher profile created', profile);
  }

  @Get('profiles')
  @UseGuards(JwtAuthGuard)
  async findAllProfiles(@Query('activeOnly') activeOnly?: string) {
    const profiles = await this.voucherService.findAllProfiles(
      activeOnly === 'true',
    );
    return ApiResponseDto.success('Voucher profiles retrieved', profiles);
  }

  @Get('profiles/:id')
  @UseGuards(JwtAuthGuard)
  async findProfile(@Param('id') id: string) {
    const profile = await this.voucherService.findProfile(id);
    return ApiResponseDto.success('Voucher profile retrieved', profile);
  }

  @Patch('profiles/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  async updateProfile(
    @Param('id') id: string,
    @Body() updateDto: UpdateVoucherProfileDto,
  ) {
    const profile = await this.voucherService.updateProfile(id, updateDto);
    return ApiResponseDto.success('Voucher profile updated', profile);
  }

  @Delete('profiles/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN)
  async deleteProfile(
    @Param('id') id: string,
    @Query('force') force?: string,
  ) {
    try {
      const forceDelete = force === 'true';
      const result = await this.voucherService.deleteProfile(id, forceDelete);
      return ApiResponseDto.success(result.message);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error; // Re-throw BadRequestException
      }
      throw new InternalServerErrorException('Failed to delete profile');
    }
  }

  // ==========================================
  // VOUCHERS (Admin)
  // ==========================================

  @Post('generate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.OPERATOR)
  async generateVouchers(@Body() generateDto: GenerateVoucherDto) {
    const result = await this.voucherService.generateVouchers(generateDto);
    return ApiResponseDto.success(
      `${result.vouchers.length} vouchers generated`,
      result,
    );
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async findAllVouchers(
    @Query('status') status?: VoucherStatus,
    @Query('profileId') profileId?: string,
    @Query('batchId') batchId?: string,
    @Query('search') search?: string,
  ) {
    const vouchers = await this.voucherService.findAllVouchers({
      status,
      profileId,
      batchId,
      search,
    });
    return ApiResponseDto.success('Vouchers retrieved', vouchers);
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard)
  async getStats() {
    const stats = await this.voucherService.getStats();
    return ApiResponseDto.success('Voucher statistics retrieved', stats);
  }

  /**
   * Check if MAC address has active session
   * Called by portal on page load
   * NOTE: Harus dideklarasikan SEBELUM @Get(':id') agar tidak tertelan route param
   */
  @Get('check-session')
  @Public()
  async checkSession(@Query('mac') mac: string) {
    if (!mac) {
      throw new BadRequestException('MAC address is required');
    }
    
    const result = await this.voucherService.checkActiveSession(mac);
    return ApiResponseDto.success(
      result.active ? 'Active session found' : 'No active session',
      result,
    );
  }

  @Get('pending')
  @Public()
  async getPendingVoucher(@Query('mac') mac: string) {
    if (!mac) {
      throw new BadRequestException('MAC address is required');
    }

    const result = await this.voucherService.getPendingVoucher(mac);
    return ApiResponseDto.success(
      result.pending ? 'Pending voucher found' : 'No pending voucher',
      result,
    );
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findVoucher(@Param('id') id: string) {
    const voucher = await this.voucherService.findVoucher(id);
    return ApiResponseDto.success('Voucher retrieved', voucher);
  }

  @Patch(':id/disable')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  async disableVoucher(@Param('id') id: string) {
    const voucher = await this.voucherService.disableVoucher(id);
    return ApiResponseDto.success('Voucher disabled', voucher);
  }

  // ==========================================
  // PORTAL FLOW (Public endpoints)
  // ==========================================

  @Post('claim-free')
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // max 10 klaim/min/IP
  async claimFree(@Body() claimDto: ClaimFreeVoucherDto) {
    const result = await this.voucherService.claimFreeVoucher(
      claimDto.mac,
      claimDto.ip,
      claimDto.accessType,
    );
    return ApiResponseDto.success(
      result.alreadyConnected ? 'Sudah terhubung' : 'Akses internet siap diaktifkan',
      result,
    );
  }

  @Post('request')
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // max 5 request/min/IP
  async requestVoucher(@Body() requestDto: RequestVoucherDto) {
    const result = await this.voucherService.requestVoucher(
      requestDto.phone,
      requestDto.mac,
      requestDto.ip,
    );
    return ApiResponseDto.success('Voucher berhasil dibuat', result);
  }

  @Post('resend')
  @Public()
  @Throttle({ default: { limit: 3, ttl: 60000 } }) // max 3 resend/min/IP
  async resendVoucher(@Body() requestDto: RequestVoucherDto) {
    const result = await this.voucherService.resendVoucher(
      requestDto.phone,
      requestDto.mac,
      requestDto.ip,
    );
    return ApiResponseDto.success('Voucher lama dinonaktifkan, voucher baru dibuat', result);
  }

  @Post('redeem')
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async redeemVoucher(@Body() redeemDto: RedeemVoucherDto) {
    const result = await this.voucherService.redeemVoucher(redeemDto);
    return ApiResponseDto.success('Voucher redeemed successfully', result);
  }

  // ==========================================
  // AUTHENTICATION API (Public endpoints for portal)
  // ==========================================

  /**
   * Authenticate voucher and create Mikrotik session
   * Called by portal when user submits voucher code
   */
  @Post('authenticate')
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // max 10 percobaan/min/IP
  async authenticateVoucher(@Body() dto: AuthenticateVoucherDto) {
    const result = await this.voucherService.authenticateVoucher(
      dto.code,
      dto.mac,
      dto.ip,
      dto.linkOrig,
    );
    return ApiResponseDto.success(result.message, result);
  }

  /**
   * Disconnect user session by MAC address
   * Called by portal logout functionality
   */
  @Post('disconnect')
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async disconnect(@Body() dto: DisconnectDto) {
    const result = await this.voucherService.disconnectSession(dto.mac);
    return ApiResponseDto.success(result.message, result);
  }
}
