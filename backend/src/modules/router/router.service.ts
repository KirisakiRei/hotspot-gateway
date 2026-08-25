import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/common/prisma.service';
import { CreateRouterDto, UpdateRouterDto } from './dto/router.dto';

@Injectable()
export class RouterService {
  private readonly logger = new Logger(RouterService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Seed router default (ROUTER-001) jika belum ada sama sekali di database.
   */
  async ensureDefaultRouter() {
    const count = await this.prisma.router.count();
    if (count === 0) {
      const defaultName = 'ROUTER-001';
      const defaultHost = 'dynamic';
      await this.prisma.router.create({
        data: {
          name: defaultName,
          location: 'Main Hotspot Gateway',
          host: defaultHost,
          status: 'ACTIVE',
          // Tidak boleh dianggap online sebelum paket RADIUS benar-benar tiba.
          lastSeenAt: null,
        },
      });
      this.logger.log(`Default Router (${defaultName}) seeded successfully`);
    }
  }

  async getAllRouters() {
    await this.ensureDefaultRouter();

    const routers = await this.prisma.router.findMany({
      include: {
        _count: {
          select: {
            sessions: {
              where: { endedAt: null },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const now = Date.now();
    const IDLE_THRESHOLD_MS = 5 * 60 * 1000; // 5 menit

    return routers.map((r) => {
      const lastSeen = r.lastSeenAt ? new Date(r.lastSeenAt).getTime() : 0;
      const isOnline = lastSeen > 0 && now - lastSeen < IDLE_THRESHOLD_MS;

      return {
        id: r.id,
        name: r.name,
        location: r.location,
        host: r.host,
        port: r.port,
        status: r.status,
        lastSeenAt: r.lastSeenAt,
        activeSessionsCount: r._count.sessions,
        isOnline,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      };
    });
  }

  async getRouterById(id: string) {
    const router = await this.prisma.router.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            sessions: {
              where: { endedAt: null },
            },
          },
        },
      },
    });
    if (!router) throw new NotFoundException('Router tidak ditemukan');
    return router;
  }

  async createRouter(dto: CreateRouterDto) {
    const existing = await this.prisma.router.findFirst({
      where: { name: dto.name.trim() },
    });
    if (existing) {
      throw new ConflictException(`Router dengan nama "${dto.name}" sudah terdaftar`);
    }

    return this.prisma.router.create({
      data: {
        name: dto.name.trim(),
        location: dto.location?.trim() || null,
        host: dto.host?.trim() || 'dynamic',
        port: dto.port || 8728,
        radiusSecret: dto.radiusSecret || null,
        status: dto.status || 'ACTIVE',
      },
    });
  }

  async updateRouter(id: string, dto: UpdateRouterDto) {
    await this.getRouterById(id);

    if (dto.name) {
      const existing = await this.prisma.router.findFirst({
        where: { name: dto.name.trim(), id: { not: id } },
      });
      if (existing) {
        throw new ConflictException(`Router dengan nama "${dto.name}" sudah digunakan`);
      }
    }

    return this.prisma.router.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name.trim() }),
        ...(dto.location !== undefined && { location: dto.location?.trim() || null }),
        ...(dto.host && { host: dto.host.trim() }),
        ...(dto.port !== undefined && { port: dto.port }),
        ...(dto.radiusSecret !== undefined && { radiusSecret: dto.radiusSecret || null }),
        ...(dto.status && { status: dto.status }),
      },
    });
  }

  async deleteRouter(id: string) {
    await this.getRouterById(id);
    await this.prisma.router.delete({ where: { id } });
    return { deleted: true };
  }

  /**
   * Mengambil sesi aktif per Router atau keseluruhan dari DB.
   */
  async getActiveSessions(routerId?: string) {
    const where: any = {
      endedAt: null,
    };
    if (routerId) {
      where.routerId = routerId;
    }

    const sessions = await this.prisma.session.findMany({
      where,
      include: {
        user: {
          include: {
            voucher: {
              include: {
                profile: true,
              },
            },
          },
        },
        router: {
          select: {
            id: true,
            name: true,
            location: true,
          },
        },
      },
      orderBy: { startedAt: 'desc' },
      take: 100,
    });

    return sessions.map((s) => {
      const bytesIn = Number(s.bytesIn || 0n);
      const bytesOut = Number(s.bytesOut || 0n);
      const now = new Date().getTime();
      const started = new Date(s.startedAt).getTime();
      const uptimeSec = Math.max(0, Math.floor((now - started) / 1000));

      return {
        id: s.id,
        macAddress: s.macAddress,
        ipAddress: s.ipAddress,
        router: s.router?.name || 'Default Router',
        routerLocation: s.router?.location || '-',
        userName: s.user?.name || s.user?.phone || 'Guest',
        voucherCode: s.user?.voucher?.code || '-',
        profileName: s.user?.voucher?.profile?.name || '-',
        bytesIn,
        bytesOut,
        totalBytes: bytesIn + bytesOut,
        uptimeSec,
        startedAt: s.startedAt,
        expiresAt: s.user?.voucher?.expiresAt,
      };
    });
  }

  /**
   * Generator Script RouterOS MikroTik untuk Direct RADIUS
   */
  async generateSetupScript(routerId: string) {
    const router = await this.getRouterById(routerId);
    const vpsIp = this.configService.get<string>('VPS_PUBLIC_IP') || '165.22.240.104';
    const radiusSecret = router.radiusSecret || this.configService.get<string>('RADIUS_SHARED_SECRET') || 'jWMd2VjWjHCRzVKnNVYTFmJLT5sFSbmeNsgaoAWUY5C9gPHF';
    const portalDomain = this.configService.get<string>('PORTAL_DOMAIN') || 'wifi.rekavia.com';

    const script = `# ============================================================
# MikroTik Hotspot Setup — Direct RADIUS
# Router Identity: ${router.name}
# Lokasi: ${router.location || 'Utama'}
# Gateway VPS: ${vpsIp}
# ============================================================

# 1. Set System Identity (NAS-Identifier)
/system identity set name="${router.name}"

# 2. Setup RADIUS Client
/radius remove [find comment="FreeRADIUS VPS"]
/radius add \\
    service=hotspot \\
    address=${vpsIp} \\
    secret="${radiusSecret}" \\
    authentication-port=1812 \\
    accounting-port=1813 \\
    timeout=1000ms \\
    comment="FreeRADIUS VPS"

# 3. Aktifkan Incoming PoD/CoA (Port 3799)
/radius incoming set accept=yes port=3799

# 4. Update Hotspot Profile untuk menggunakan RADIUS
/ip hotspot profile set [find default=yes] \\
    use-radius=yes \\
    radius-accounting=yes \\
    radius-interim-update=1m \\
    login-by=http-pap,http-chap,cookie,mac-cookie

# 5. Bypass Walled Garden untuk Portal
/ip hotspot walled-garden add dst-host="${portalDomain}" action=allow comment="Portal Auth"
/ip hotspot walled-garden ip add dst-host="${portalDomain}" action=accept comment="Bypass HTTPS Portal"

# 6. Nonaktifkan API 8728 untuk optimasi CPU
/ip service set api disabled=yes
/ip service set www disabled=yes
/ip service set ftp disabled=yes
/ip service set telnet disabled=yes
`;

    return {
      routerName: router.name,
      vpsIp,
      portalDomain,
      script,
    };
  }
}
