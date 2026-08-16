// ==========================================
// WHATSAPP GATEWAY - Transport Controller (HTTP API)
// ==========================================

import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { AddSessionDto } from './dto/add-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { SendVoucherDto } from './dto/send-voucher.dto';
import { CheckNumberDto, ContactInfoDto } from './dto/contact.dto';
import { ListLogsQueryDto, UpdateConfigDto } from './dto/config.dto';

const ok = (data: unknown, message?: string) => ({ success: true, message, data });
const fail = (error: unknown) => ({
  success: false,
  message: error instanceof Error ? error.message : String(error),
  data: null,
});

@Controller('whatsapp')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WhatsappController {
  constructor(private readonly whatsappService: WhatsappService) {}

  // ==========================================
  // STATUS & CONFIG
  // ==========================================

  @Get('status')
  @Roles('SUPER_ADMIN', 'ADMIN')
  async getStatus() {
    return ok(await this.whatsappService.getStatus());
  }

  @Get('config')
  @Roles('SUPER_ADMIN', 'ADMIN')
  async getConfig() {
    return ok(await this.whatsappService.getConfig());
  }

  @Put('config')
  @Roles('SUPER_ADMIN', 'ADMIN')
  async updateConfig(@Body() dto: UpdateConfigDto) {
    return ok(await this.whatsappService.updateConfig(dto), 'Konfigurasi WhatsApp diperbarui');
  }

  @Post('test')
  @Roles('SUPER_ADMIN', 'ADMIN')
  async test() {
    const result = await this.whatsappService.test();
    return {
      success: result.connected,
      message: result.connected ? 'WhatsApp gateway berfungsi' : 'WhatsApp gateway belum siap',
      data: result,
    };
  }

  // ==========================================
  // SESSION MANAGEMENT
  // ==========================================

  @Get('sessions')
  @Roles('SUPER_ADMIN', 'ADMIN')
  async listSessions() {
    return ok(await this.whatsappService.listSessions());
  }

  @Post('sessions')
  @Roles('SUPER_ADMIN', 'ADMIN')
  async addSession(@Body() dto: AddSessionDto) {
    try {
      return ok(await this.whatsappService.addSession(dto.phone, dto.name), 'Nomor ditambahkan');
    } catch (error) {
      return fail(error);
    }
  }

  @Put('sessions/:phone')
  @Roles('SUPER_ADMIN', 'ADMIN')
  async updateSession(@Param('phone') phone: string, @Body() dto: UpdateSessionDto) {
    try {
      return ok(await this.whatsappService.updateSession(phone, dto), 'Sesi diperbarui');
    } catch (error) {
      return fail(error);
    }
  }

  @Delete('sessions/:phone')
  @Roles('SUPER_ADMIN', 'ADMIN')
  async removeSession(@Param('phone') phone: string) {
    try {
      await this.whatsappService.removeSession(phone);
      return ok(null, 'Sesi dihapus');
    } catch (error) {
      return fail(error);
    }
  }

  @Get('sessions/:phone/qr')
  @Roles('SUPER_ADMIN', 'ADMIN')
  async getQr(@Param('phone') phone: string) {
    const qr = await this.whatsappService.getQr(phone);
    if (!qr) {
      throw new BadRequestException('QR tidak tersedia (sesi belum dalam mode pairing)');
    }
    return ok({ qr });
  }

  @Post('sessions/:phone/connect')
  @Roles('SUPER_ADMIN', 'ADMIN')
  async connectSession(@Param('phone') phone: string) {
    try {
      return ok(await this.whatsappService.connectSession(phone), 'Sesi mulai dihubungkan');
    } catch (error) {
      return fail(error);
    }
  }

  @Post('sessions/:phone/logout')
  @Roles('SUPER_ADMIN', 'ADMIN')
  async logoutSession(@Param('phone') phone: string) {
    try {
      await this.whatsappService.logoutSession(phone);
      return ok(null, 'Sesi dilogout (perlu scan QR ulang)');
    } catch (error) {
      return fail(error);
    }
  }

  // ==========================================
  // SEND
  // ==========================================

  @Post('send')
  @Roles('SUPER_ADMIN', 'ADMIN')
  async sendMessage(@Body() dto: SendMessageDto) {
    const sent = await this.whatsappService.sendText(dto.phone, dto.message);
    return {
      success: sent,
      message: sent ? 'Pesan terkirim' : 'Pesan gagal dikirim (periksa status sesi)',
      data: { sent },
    };
  }

  @Post('send-voucher')
  @Roles('SUPER_ADMIN', 'ADMIN')
  async sendVoucher(@Body() dto: SendVoucherDto) {
    const sent = await this.whatsappService.sendVoucher(dto.phone, dto.voucherCode, dto.profile);
    return {
      success: sent,
      message: sent ? 'Voucher terkirim' : 'Voucher gagal dikirim (periksa status sesi)',
      data: { sent },
    };
  }

  // ==========================================
  // CONTACT / NUMBER
  // ==========================================

  @Post('check-number')
  @Roles('SUPER_ADMIN', 'ADMIN')
  async checkNumber(@Body() dto: CheckNumberDto) {
    const exists = await this.whatsappService.checkNumber(dto.phone);
    return ok({ phone: dto.phone, exists });
  }

  @Post('contact-info')
  @Roles('SUPER_ADMIN', 'ADMIN')
  async contactInfo(@Body() dto: ContactInfoDto) {
    return ok({ phone: dto.phone, ...(await this.whatsappService.getContactInfo(dto.phone)) });
  }

  // ==========================================
  // LOGS
  // ==========================================

  @Get('logs')
  @Roles('SUPER_ADMIN', 'ADMIN')
  async listLogs(@Query() query: ListLogsQueryDto) {
    const result = await this.whatsappService.listLogs({
      limit: query.limit,
      offset: query.offset,
      status: query.status,
      sessionPhone: query.sessionPhone,
      recipientPhone: query.recipientPhone,
    });
    return ok(result);
  }
}
