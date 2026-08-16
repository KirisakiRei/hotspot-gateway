import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '@/common/prisma.service';
import { UserStatus, Prisma, LogType, type User } from '@prisma/client';
import { SessionService } from '@/modules/session/session.service';
import { getErrorMessage } from '@/common/utils/error';

type UserWithSessionRelation = User & {
  sessions?: Array<{
    bytesIn: bigint;
    bytesOut: bigint;
    ipAddress: string | null;
    server: string | null;
  }>;
};

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionService: SessionService,
  ) {}

  /**
   * Mengambil seluruh data user dari database (read-mostly).
   * Status online/offline dan statistik bytes disinkronkan secara kontinu
   * oleh SessionService via event /listen MikroTik.
   */
  async findAll(filters?: {
    status?: UserStatus;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const { status, search, page = 1, limit = 20 } = filters || {};

    const where: Prisma.UserWhereInput = {};

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { phone: { contains: search } },
        { email: { contains: search } },
        { macAddress: { contains: search } },
        { ipAddress: { contains: search } },
        { name: { contains: search } },
      ];
    }

    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        include: {
          sessions: {
            where: { endedAt: null },
            orderBy: { startedAt: 'desc' },
            take: 1,
          },
          voucher: {
            include: {
              profile: true,
            },
          },
          _count: {
            select: { sessions: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    const enrichedUsers = users.map((user) => this.enrichUserFromDbSession(user));

    return {
      data: enrichedUsers,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  private enrichUserFromDbSession(user: UserWithSessionRelation) {
    const session = user.sessions?.[0];

    if (user.status === 'ONLINE' && session) {
      const bytesIn = Number(session.bytesIn ?? 0);
      const bytesOut = Number(session.bytesOut ?? 0);
      const totalBytes = bytesIn + bytesOut;

      return {
        ...user,
        ipAddress: session.ipAddress || user.ipAddress,
        server: session.server || user.server || 'hotspot1',
        uptime: null,
        bytesIn,
        bytesOut,
        sessionTime: null,
        quotaUsed: BigInt(totalBytes),
      };
    }

    return {
      ...user,
      uptime: null,
      bytesIn: 0,
      bytesOut: 0,
      sessionTime: null,
      quotaUsed: BigInt(0),
    };
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        voucher: true,
        sessions: {
          orderBy: { startedAt: 'desc' },
          take: 10,
        },
        _count: {
          select: { sessions: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  /**
   * Mengambil daftar user ONLINE dari database
   */
  async findOnlineUsers() {
    const users = await this.prisma.user.findMany({
      where: { status: 'ONLINE' },
      include: {
        voucher: {
          include: {
            profile: true,
          },
        },
        sessions: {
          where: { endedAt: null },
          orderBy: { startedAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { loginAt: 'desc' },
    });

    return users.map((user) => this.enrichUserFromDbSession(user));
  }

  /**
   * Kick user secara terpadu (Router + DB close)
   */
  async kickUser(id: string) {
    const user = await this.findById(id);

    if (!user.macAddress) {
      throw new NotFoundException('User tidak memiliki MAC address');
    }

    try {
      await this.sessionService.kickSession(user.macAddress);
      this.logger.log(`User ${user.phone} (MAC: ${user.macAddress}) berhasil di-kick`);

      // Catat ke system log
      await this.prisma.systemLog.create({
        data: {
          action: 'USER_KICKED',
          type: LogType.ADMIN,
          description: `User ${user.phone} di-kick oleh admin`,
          metadata: {
            phone: user.phone,
            macAddress: user.macAddress,
          },
          ipAddress: 'system',
        },
      });

      return { message: 'User disconnected successfully' };
    } catch (error: unknown) {
      this.logger.error(`Gagal melakukan kick user: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  async blockUser(id: string, reason?: string) {
    const user = await this.findById(id);

    // Bila ada MAC aktif, kick terlebih dahulu
    if (user.macAddress) {
      try {
        await this.sessionService.kickSession(user.macAddress);
      } catch (error) {
        this.logger.warn(`Kick saat block gagal untuk MAC ${user.macAddress}: ${getErrorMessage(error)}`);
      }
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        status: 'BLOCKED',
        isBlocked: true,
        blockReason: reason,
      },
    });

    await this.prisma.systemLog.create({
      data: {
        action: 'USER_BLOCKED',
        type: LogType.ADMIN,
        description: `User ${user.phone} diblokir`,
        metadata: {
          phone: user.phone,
          macAddress: user.macAddress,
          reason,
        },
        ipAddress: 'system',
      },
    });

    return updated;
  }

  async unblockUser(id: string) {
    const user = await this.findById(id);

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        status: 'OFFLINE',
        isBlocked: false,
        blockReason: null,
      },
    });

    await this.prisma.systemLog.create({
      data: {
        action: 'USER_UNBLOCKED',
        type: LogType.ADMIN,
        description: `User ${user.phone} dibuka blokirnya`,
        metadata: {
          phone: user.phone,
          macAddress: user.macAddress,
        },
        ipAddress: 'system',
      },
    });

    return updated;
  }

  async deleteUser(id: string) {
    const user = await this.findById(id);

    // Kick aktif bila ada
    if (user.macAddress) {
      try {
        await this.sessionService.kickSession(user.macAddress);
      } catch (error) {
        this.logger.warn(`Kick saat hapus user gagal: ${getErrorMessage(error)}`);
      }
    }

    // Hapus sesi terkait
    await this.prisma.session.deleteMany({
      where: { userId: id },
    });

    await this.prisma.user.delete({
      where: { id },
    });

    await this.prisma.systemLog.create({
      data: {
        action: 'USER_DELETED',
        type: LogType.ADMIN,
        description: `User ${user.phone} dihapus`,
        metadata: {
          phone: user.phone,
          macAddress: user.macAddress,
        },
        ipAddress: 'system',
      },
    });

    return { message: 'User deleted successfully' };
  }

  async getStats() {
    const [total, online, offline, blocked] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { status: 'ONLINE' } }),
      this.prisma.user.count({ where: { status: 'OFFLINE' } }),
      this.prisma.user.count({ where: { status: 'BLOCKED' } }),
    ]);

    return {
      total,
      online,
      offline,
      blocked,
    };
  }
}
