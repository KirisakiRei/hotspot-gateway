import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '@/common/prisma.service';
import { MikrotikService } from '@/modules/mikrotik/mikrotik.service';
import { normalizeMac } from '@/common/utils/mac';
import { getErrorMessage } from '@/common/utils/error';
import type { MikrotikRecord } from '@/modules/mikrotik/mikrotik.types';

@Injectable()
export class SessionService implements OnModuleInit {
  private readonly logger = new Logger(SessionService.name);
  private syncStarted = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mikrotikService: MikrotikService,
  ) {}

  async onModuleInit() {
    this.startActiveSessionSync();
  }

  /**
   * Subscribe ke aliran event /ip/hotspot/active/listen RouterOS
   * MikroTik secara otomatis mendorong event connect/disconnect real-time
   */
  private startActiveSessionSync() {
    if (this.syncStarted) return;
    this.syncStarted = true;

    this.mikrotikService
      .subscribeToActiveSessions('internal-session-sync', (record: MikrotikRecord) => {
        this.handleMikrotikSessionEvent(record).catch((error) => {
          this.logger.error(`Gagal memproses event sesi MikroTik: ${getErrorMessage(error)}`);
        });
      })
      .then((ok) => {
        if (!ok) {
          this.logger.warn('Stream /listen sesi MikroTik belum tersambung (router offline?) — mencoba lagi dalam 60 detik');
          setTimeout(() => {
            this.syncStarted = false;
            this.startActiveSessionSync();
          }, 60000);
        } else {
          this.logger.log('Sinkronisasi sesi otomatis via /listen MikroTik aktif');
        }
      })
      .catch((error) => {
        this.logger.error(`Gagal inisialisasi listener sesi: ${getErrorMessage(error)}`);
        setTimeout(() => {
          this.syncStarted = false;
          this.startActiveSessionSync();
        }, 60000);
      });
  }

  /**
   * Parsing format bytes MikroTik (e.g. "1.2MiB", "500KiB", "123456")
   */
  private parseBytes(value: string | number | boolean | undefined): number {
    if (typeof value === 'number') return value;
    if (!value || typeof value === 'boolean') return 0;

    const str = value.toString();
    const match = str.match(/^([\d.]+)\s*(KiB|MiB|GiB|K|M|G|B)?$/i);
    if (!match) return parseInt(str, 10) || 0;

    const num = parseFloat(match[1]);
    const unit = (match[2] || '').toUpperCase();

    switch (unit) {
      case 'KIB':
      case 'K':
        return Math.round(num * 1024);
      case 'MIB':
      case 'M':
        return Math.round(num * 1024 * 1024);
      case 'GIB':
      case 'G':
        return Math.round(num * 1024 * 1024 * 1024);
      default:
        return Math.round(num);
    }
  }

  /**
   * Handle event dari MikroTik stream
   */
  private async handleMikrotikSessionEvent(record: MikrotikRecord) {
    const rawMac = String(record['mac-address'] || record.mac || '');
    const mac = normalizeMac(rawMac);
    if (!mac) return;

    const isRemoved = Boolean(record['.dead']);

    if (isRemoved) {
      await this.closeOpenSessionByMac(mac);
      return;
    }

    const bytesInNum = this.parseBytes(record['bytes-in']);
    const bytesOutNum = this.parseBytes(record['bytes-out']);
    const bytesIn = BigInt(bytesInNum);
    const bytesOut = BigInt(bytesOutNum);
    const ipAddress = String(record.address || record.ip || '0.0.0.0');
    const server = String(record.server || 'hotspot1');

    // Cari sesi aktif yang belum ditutup
    const openSession = await this.prisma.session.findFirst({
      where: { macAddress: mac, endedAt: null },
      orderBy: { startedAt: 'desc' },
    });

    if (openSession) {
      await this.prisma.session.update({
        where: { id: openSession.id },
        data: {
          bytesIn,
          bytesOut,
          ipAddress: ipAddress !== '0.0.0.0' ? ipAddress : openSession.ipAddress,
        },
      });

      await this.prisma.user.updateMany({
        where: { macAddress: mac, status: { not: 'BLOCKED' } },
        data: {
          status: 'ONLINE',
          ipAddress: ipAddress !== '0.0.0.0' ? ipAddress : undefined,
          server,
        },
      });
    } else {
      // Buat record sesi baru jika user terdaftar di database
      const user = await this.prisma.user.findFirst({
        where: { macAddress: mac },
      });

      if (user) {
        await this.prisma.session.create({
          data: {
            userId: user.id,
            ipAddress,
            macAddress: mac,
            server,
            bytesIn,
            bytesOut,
            startedAt: new Date(),
          },
        });

        await this.prisma.user.updateMany({
          where: { macAddress: mac, status: { not: 'BLOCKED' } },
          data: {
            status: 'ONLINE',
            ipAddress,
            server,
            loginAt: new Date(),
          },
        });
      }
    }
  }

  /**
   * Unified Kick: Memutuskan koneksi aktif di router sekaligus menutup sesi di DB
   */
  async kickSession(mac: string): Promise<boolean> {
    const normalized = normalizeMac(mac);
    if (!normalized) return false;

    // 1. Eksekusi kick di MikroTik API (seam adapter AAA)
    try {
      await this.mikrotikService.disconnectUserByMac(normalized);
    } catch (error) {
      this.logger.warn(`Gagal mengirim perintah disconnect router untuk MAC ${normalized}: ${getErrorMessage(error)}`);
    }

    // 2. Tutup seluruh baris Session yang masih terbuka di DB
    await this.closeOpenSessionByMac(normalized);
    return true;
  }

  /**
   * Menutup sesi di database (set endedAt = now()) dan ubah status user menjadi OFFLINE
   */
  async closeOpenSessionByMac(mac: string): Promise<void> {
    const normalized = normalizeMac(mac);
    if (!normalized) return;

    const now = new Date();

    const result = await this.prisma.session.updateMany({
      where: {
        macAddress: normalized,
        endedAt: null,
      },
      data: { endedAt: now },
    });

    await this.prisma.user.updateMany({
      where: {
        macAddress: normalized,
        status: 'ONLINE',
      },
      data: {
        status: 'OFFLINE',
        logoutAt: now,
      },
    });

    this.logger.log(`Sesi database ditutup untuk MAC: ${normalized} (${result.count} sesi)`);
  }
}
