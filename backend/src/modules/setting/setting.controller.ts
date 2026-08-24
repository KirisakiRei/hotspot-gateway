import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { SettingService } from './setting.service';
import { MikrotikService } from '@/modules/mikrotik/mikrotik.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { ApiResponseDto } from '@/common/dto/api-response.dto';
import { AdminRole } from '@prisma/client';

@Controller('settings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SettingController {
  private readonly logger = new Logger(SettingController.name);

  constructor(
    private readonly settingService: SettingService,
    private readonly mikrotikService: MikrotikService,
  ) {}

  @Get()
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  async getSettings(@Query('group') group?: string) {
    // Mask secret agar tidak bocor ke klien
    return this.settingService.findAll(group, { maskSecrets: true });
  }

  // Specific routes must come before dynamic :key routes
  @Get('voucher/generate-settings')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  async getVoucherGenerateSettings() {
    this.logger.debug('Retrieving voucher generation settings');
    
    const settings = await this.settingService.findByKey('voucher_generate_settings');
    
    if (!settings) {
      this.logger.debug('No voucher generation settings found. Returning defaults.');
      return {
        success: true,
        data: {
          profileId: '',
          prefix: '',
          length: 8,
          format: 'number',
        },
      };
    }

    try {
      const parsed = JSON.parse(settings.value);
      this.logger.debug('Voucher generation settings retrieved successfully');
      return {
        success: true,
        data: parsed,
      };
    } catch (error) {
      this.logger.error('Failed to parse voucher generation settings JSON:', error);
      return {
        success: true,
        data: {
          profileId: '',
          prefix: '',
          length: 8,
          format: 'number',
        },
      };
    }
  }

  @Put('voucher/generate-settings')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  async updateVoucherGenerateSettings(
    @Body() settings: { profileId?: string; prefix?: string; length?: number; format?: string },
  ) {
    this.logger.log('Updating voucher generation settings');
    
    try {
      const value = JSON.stringify({
        profileId: settings.profileId || '',
        prefix: settings.prefix || '',
        length: settings.length || 8,
        format: settings.format || 'number',
      });

      await this.settingService.update('voucher_generate_settings', value, 'voucher');

      this.logger.log('Voucher generation settings updated successfully');

      return {
        success: true,
        message: 'Voucher generate settings updated',
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to update voucher generation settings: ${message}`);
      throw error;
    }
  }

  @Get('mikrotik')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  async getMikrotikSettings() {
    const config = await this.settingService.getMikrotikConfig();
    return {
      success: true,
      data: maskSecrets(config),
    };
  }

  @Get('portal')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  async getPortalSettings() {
    return this.settingService.getPortalConfig();
  }

  @Get('portal/profile-mapping')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  async getPortalProfileMapping() {
    const [free, survey] = await Promise.all([
      this.settingService.findByKey('portal_free_profile_id'),
      this.settingService.findByKey('portal_survey_profile_id'),
    ]);
    return ApiResponseDto.success('Portal profile mapping retrieved', {
      freeProfileId: free?.value || '',
      surveyProfileId: survey?.value || '',
    });
  }

  @Put('portal/profile-mapping')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  async updatePortalProfileMapping(
    @Body() body: { freeProfileId?: string; surveyProfileId?: string },
  ) {
    if (body.freeProfileId !== undefined) {
      await this.settingService.update('portal_free_profile_id', body.freeProfileId, 'portal');
    }
    if (body.surveyProfileId !== undefined) {
      await this.settingService.update('portal_survey_profile_id', body.surveyProfileId, 'portal');
    }
    return ApiResponseDto.success('Portal profile mapping updated');
  }

  // ==========================================
  // DYNAMIC KEY ROUTES (Must be last)
  // ==========================================

  @Get(':key')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  async getSettingByKey(@Param('key') key: string) {
    return this.settingService.findByKey(key);
  }

  @Put(':key')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  async updateSetting(
    @Param('key') key: string,
    @Body('value') value: string,
  ) {
    return this.settingService.update(key, value);
  }

  @Put()
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  async updateMultipleSettings(
    @Body() settings: Array<{ key: string; value: string }>,
  ) {
    await this.settingService.updateMultiple(settings);
    return {
      success: true,
      message: 'Settings updated successfully',
    };
  }

  @Post('test-mikrotik')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  async testMikrotikConnection() {
    try {
      const config = await this.settingService.getMikrotikConfig();
      
      this.logger.debug(`Testing Mikrotik connection to ${config.host}:${config.port}`);
      
      const result = await this.mikrotikService.testConnection(
        config.host,
        parseInt(config.port),
        config.username,
        config.password,
      );

      this.logger.log('Mikrotik connection test successful');

      return {
        success: true,
        message: 'Mikrotik connection successful',
        data: { connected: true, ...result },
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Mikrotik connection test failed: ${message}`);
      
      return {
        success: false,
        message: 'Mikrotik connection failed',
        data: { connected: false },
        error: message,
      };
    }
  }
}

// ==========================================
// HELPERS
// ==========================================

const SECRET_KEY_PATTERN = /(password|passwd|secret|api[_-]?key|token|credential)/i;

/**
 * Kosongkan field yang berpotensi secret sebelum dikirim ke klien.
 * Nilai asli tetap tersimpan di DB; frontend mengirim '' saat save
 * dan backend skip update untuk secret kosong.
 */
function maskSecrets(config: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(config)) {
    out[key] = SECRET_KEY_PATTERN.test(key) && typeof value === 'string' && value !== ''
      ? ''
      : value;
  }
  return out;
}
