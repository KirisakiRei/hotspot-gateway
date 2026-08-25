import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
  UnauthorizedException,
  ForbiddenException,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { RadiusService } from './radius.service';
import { RadiusAuthorizeDto, RadiusAccountingDto } from './dto/radius.dto';

/**
 * Endpoint untuk FreeRADIUS rlm_rest.
 * Hanya bisa diakses dari localhost (FreeRADIUS).
 * Guard utama: source IP harus localhost. Header X-Radius-Secret digunakan
 * sebagai defense-in-depth bila rlm_rest meneruskannya. Beberapa build
 * FreeRADIUS 3 tidak mengirim custom header dari block global `headers`,
 * sehingga menjadikannya syarat mutlak membuat autentikasi RADIUS gagal
 * meskipun request benar-benar datang dari local FreeRADIUS host.
 */
@Controller('radius')
export class RadiusController {
  private readonly logger = new Logger(RadiusController.name);
  private readonly RADIUS_SECRET = process.env.RADIUS_INTERNAL_SECRET || 'radius-internal-secret';

  constructor(private readonly radiusService: RadiusService) {}

  private checkAccess(req: Request): void {
    // Hanya izinkan dari localhost
    const ip = req.ip || req.socket?.remoteAddress || '';
    const isLocal = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';

    if (!isLocal) {
      this.logger.warn(`RADIUS endpoint akses ditolak dari IP: ${ip}`);
      throw new ForbiddenException('Akses ditolak');
    }

    // Defense-in-depth: validasi header jika modul REST mengirimkannya.
    // Keamanan boundary tetap dijaga oleh localhost-only check di atas.
    const secret = req.headers['x-radius-secret'] as string;
    if (secret && secret !== this.RADIUS_SECRET) {
      this.logger.warn('RADIUS endpoint: secret tidak valid');
      throw new UnauthorizedException('Secret tidak valid');
    }

    if (!secret) {
      this.logger.debug('RADIUS endpoint: request localhost tanpa X-Radius-Secret');
    }
  }

  /**
   * FreeRADIUS rlm_rest authorize endpoint.
   * Dipanggil oleh FreeRADIUS untuk memvalidasi user sebelum Access-Accept.
   */
  @Post('authorize')
  @HttpCode(HttpStatus.OK)
  async authorize(@Body() dto: RadiusAuthorizeDto, @Req() req: Request) {
    this.checkAccess(req);
    return this.radiusService.authorize(dto);
  }

  /**
   * FreeRADIUS rlm_rest accounting endpoint.
   * Dipanggil untuk Accounting-Start / Interim-Update / Accounting-Stop.
   */
  @Post('accounting')
  @HttpCode(HttpStatus.NO_CONTENT)
  async accounting(@Body() dto: RadiusAccountingDto, @Req() req: Request) {
    this.checkAccess(req);
    await this.radiusService.accounting(dto);
  }
}
