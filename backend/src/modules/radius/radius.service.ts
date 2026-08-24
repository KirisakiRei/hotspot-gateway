import {
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '@/common/prisma.service';
import { normalizeMac } from '@/common/utils/mac';
import { getErrorMessage } from '@/common/utils/error';
import { RadiusAuthorizeDto, RadiusAccountingDto, RadiusAcceptResponse } from './dto/radius.dto';

@Injectable()
export class RadiusService {
  private readonly logger = new Logger(RadiusService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Dipanggil FreeRADIUS (rlm_rest) saat authorize.
   * Validasi kode voucher dan kembalikan atribut RADIUS untuk Access-Accept.
   */
  async authorize(dto: RadiusAuthorizeDto): Promise<RadiusAcceptResponse> {
    const code = dto.username?.trim().toUpperCase();
    const mac = dto.callingStationId ? normalizeMac(dto.callingStationId) : null;
    const nasId = dto.nasIdentifier?.trim() || dto.nasIpAddress?.trim() || 'unknown';

    this.logger.log(`RADIUS authorize: user=${code} mac=${mac} nas=${nasId}`);

    if (!code) {
      throw new UnauthorizedException('Username kosong');
    }

    // Resolve router berdasarkan NAS-Identifier
    const router = await this.prisma.router.findFirst({
      where: {
        OR: [
          { name: nasId },
          { host: nasId },
        ],
        status: 'ACTIVE',
      },
    });

    if (!router) {
      this.logger.warn(`RADIUS authorize: router tidak ditemukan untuk NAS=${nasId}`);
      // Tetap lanjutkan — tidak blokir jika router belum terdaftar di DB
    } else {
      // Update lastSeenAt router
      await this.prisma.router.update({
        where: { id: router.id },
        data: { lastSeenAt: new Date() },
      }).catch(() => {/* non-fatal */});
    }

    // Cari voucher berdasarkan kode
    const voucher = await this.prisma.voucher.findUnique({
      where: { code },
      include: { profile: true },
    });

    if (!voucher) {
      this.logger.warn(`RADIUS authorize: voucher tidak ditemukan code=${code}`);
      throw new UnauthorizedException('Voucher tidak ditemukan');
    }

    // Validasi password = kode (A-PAP: user/pass = kode voucher)
    if (dto.password?.trim().toUpperCase() !== code) {
      this.logger.warn(`RADIUS authorize: password tidak cocok untuk code=${code}`);
      throw new UnauthorizedException('Password tidak valid');
    }

    // Validasi status voucher
    if (voucher.status === 'EXPIRED' || voucher.status === 'DISABLED') {
      this.logger.warn(`RADIUS authorize: voucher ${code} berstatus ${voucher.status}`);
      throw new UnauthorizedException(`Voucher sudah ${voucher.status.toLowerCase()}`);
    }

    // Voucher USED hanya boleh dipakai oleh MAC yang sama (re-login)
    if (voucher.status === 'USED' && voucher.usedBy && mac && voucher.usedBy !== mac) {
      this.logger.warn(`RADIUS authorize: voucher ${code} sudah dipakai oleh MAC lain`);
      throw new UnauthorizedException('Voucher sudah digunakan oleh perangkat lain');
    }

    // Cek expiry
    if (voucher.expiresAt && new Date() > voucher.expiresAt) {
      await this.prisma.voucher.update({
        where: { id: voucher.id },
        data: { status: 'EXPIRED' },
      }).catch(() => {/* non-fatal */});
      throw new UnauthorizedException('Voucher sudah kadaluarsa');
    }

    const profile = voucher.profile;
    const sessionTimeout = profile.duration * 60; // menit → detik

    // Mikrotik-Rate-Limit format: "rx-rate/tx-rate" = "download/upload" (kbps)
    let rateLimit = '5120k/2048k'; // default 5M down / 2M up
    if (profile.downloadSpeed && profile.uploadSpeed) {
      rateLimit = `${profile.downloadSpeed}k/${profile.uploadSpeed}k`;
    }

    // Tandai voucher ACTIVE + catat MAC jika baru
    if (voucher.status === 'UNUSED') {
      await this.prisma.voucher.update({
        where: { id: voucher.id },
        data: {
          status: 'ACTIVE',
          usedBy: mac ?? voucher.usedBy,
          usedAt: new Date(),
          activatedAt: new Date(),
          expiresAt: voucher.expiresAt ?? new Date(Date.now() + profile.duration * 60 * 1000),
        },
      }).catch((err) => {
        this.logger.error(`Gagal update voucher status: ${getErrorMessage(err)}`);
      });
    }

    this.logger.log(`RADIUS authorize: ACCEPT code=${code} timeout=${sessionTimeout}s rate=${rateLimit}`);

    return {
      control: {
        'Auth-Type': 'Accept',
      },
      reply: {
        'Session-Timeout': sessionTimeout,
        'Mikrotik-Rate-Limit': rateLimit,
      },
    };
  }

  /**
   * Dipanggil FreeRADIUS (rlm_rest) untuk Accounting-Start / Interim-Update / Accounting-Stop.
   * Sinkronisasi sesi ke database.
   */
  async accounting(dto: RadiusAccountingDto): Promise<void> {
    const statusType = dto.acctStatusType?.trim();
    const code = dto.username?.trim().toUpperCase();
    const mac = dto.callingStationId ? normalizeMac(dto.callingStationId) : null;
    const ip = dto.framedIpAddress?.trim() || '0.0.0.0';
    const nasId = dto.nasIdentifier?.trim() || dto.nasIpAddress?.trim() || 'unknown';

    this.logger.log(`RADIUS accounting: type=${statusType} user=${code} mac=${mac} nas=${nasId}`);

    if (!code || !statusType) return;

    // Update lastSeenAt router
    const router = await this.prisma.router.findFirst({
      where: {
        OR: [{ name: nasId }, { host: nasId }],
        status: 'ACTIVE',
      },
    });
    if (router) {
      await this.prisma.router.update({
        where: { id: router.id },
        data: { lastSeenAt: new Date() },
      }).catch(() => {/* non-fatal */});
    }

    const voucher = await this.prisma.voucher.findUnique({
      where: { code },
      include: { profile: true },
    }).catch(() => null);

    if (!voucher) return;

    if (statusType === 'Start') {
      await this._handleAccountingStart(voucher.id, mac, ip, router?.id);
    } else if (statusType === 'Stop') {
      const sessionTime = parseInt(dto.acctSessionTime || '0', 10);
      const bytesIn = parseInt(dto.acctInputOctets || '0', 10);
      const bytesOut = parseInt(dto.acctOutputOctets || '0', 10);
      await this._handleAccountingStop(voucher.id, mac, sessionTime, bytesIn, bytesOut);
    }
    // Interim-Update: hanya update lastSeenAt (sudah di atas)
  }

  private async _handleAccountingStart(
    voucherId: string,
    mac: string | null,
    ip: string,
    routerId?: string,
  ): Promise<void> {
    if (!mac) return;

    try {
      // Cari atau buat user guest
      let user = await this.prisma.user.findUnique({ where: { macAddress: mac } });

      if (!user) {
        const crypto = await import('crypto');
        user = await this.prisma.user.create({
          data: {
            phone: `guest-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
            macAddress: mac,
            ipAddress: ip,
            name: 'Guest User',
            status: 'ONLINE',
            loginAt: new Date(),
            voucher: { connect: { id: voucherId } },
          },
        });
      } else {
        await this.prisma.user.update({
          where: { macAddress: mac },
          data: {
            ipAddress: ip,
            status: 'ONLINE',
            loginAt: new Date(),
            voucher: { connect: { id: voucherId } },
          },
        });
      }

      // Buat session baru
      await this.prisma.session.create({
        data: {
          user: { connect: { macAddress: mac } },
          ...(routerId ? { router: { connect: { id: routerId } } } : {}),
          ipAddress: ip,
          macAddress: mac,
          startedAt: new Date(),
        },
      });

      this.logger.log(`Accounting-Start: sesi dibuka untuk MAC=${mac}`);
    } catch (err) {
      this.logger.error(`Accounting-Start error: ${getErrorMessage(err)}`);
    }
  }

  private async _handleAccountingStop(
    voucherId: string,
    mac: string | null,
    sessionTime: number,
    bytesIn: number,
    bytesOut: number,
  ): Promise<void> {
    if (!mac) return;

    try {
      const now = new Date();

      // Tutup session terbuka di DB
      await this.prisma.session.updateMany({
        where: { macAddress: mac, endedAt: null },
        data: {
          endedAt: now,
          bytesIn: BigInt(bytesIn),
          bytesOut: BigInt(bytesOut),
        },
      });

      // Update user status
      await this.prisma.user.updateMany({
        where: { macAddress: mac, status: 'ONLINE' },
        data: { status: 'OFFLINE', logoutAt: now },
      });

      // Tandai voucher USED jika sesi sudah selesai
      await this.prisma.voucher.updateMany({
        where: { id: voucherId, status: 'ACTIVE' },
        data: { status: 'USED', timeUsed: sessionTime },
      });

      this.logger.log(`Accounting-Stop: sesi ditutup MAC=${mac} uptime=${sessionTime}s in=${bytesIn} out=${bytesOut}`);
    } catch (err) {
      this.logger.error(`Accounting-Stop error: ${getErrorMessage(err)}`);
    }
  }
}
