import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '@/common/prisma.service';
import { UserStatus, Prisma, LogType, type User } from '@prisma/client';
import { MikrotikService } from '@/modules/mikrotik/mikrotik.service';
import { getErrorMessage } from '@/common/utils/error';
import type { HotspotSessionRecord } from '@/modules/mikrotik/mikrotik.types';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);
  
  constructor(
    private prisma: PrismaService,
    private mikrotikService: MikrotikService,
  ) {}

  /**
   * Get all users with real-time Mikrotik sync
   * This combines database users with Mikrotik active sessions
   * OPTIMIZED: Single Mikrotik query for both sync and enrich operations
   */
  async findAll(filters?: {
    status?: UserStatus;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const { status, search, page = 1, limit = 20 } = filters || {};
    
    // OPTIMIZATION: Get active sessions ONCE and reuse for sync + enrich
    const activeSessions = await this.mikrotikService.getActiveSessions();
    
    // Sync online status using the fetched sessions (no additional Mikrotik query)
    await this.syncOnlineStatusFromMikrotik(activeSessions);

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

    // Get users from database with full relations
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

    // Enrich with Mikrotik live data (reuse fetched sessions, no additional query)
    const enrichedUsers = this.enrichUsersWithMikrotikData(users, activeSessions);

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

  /**
   * Sync online status from Mikrotik active sessions
   * Update database status for users that are/aren't online
   * OPTIMIZED: Accept activeSessions as parameter to avoid duplicate query
   */
  private async syncOnlineStatusFromMikrotik(activeSessions?: HotspotSessionRecord[]) {
    try {
      // If not provided, fetch from Mikrotik (for standalone calls)
      const sessions = activeSessions ?? await this.mikrotikService.getActiveSessions();
      this.logger.log(`📊 Syncing ${sessions.length} active sessions from Mikrotik`);

      // Get all MAC addresses from active sessions
      const activeMacs = sessions
        .map(s => s.mac || s['mac-address'])
        .filter(Boolean)
        .map(mac => mac.toUpperCase());

      if (activeMacs.length > 0) {
        // Set users with active sessions to ONLINE
        await this.prisma.user.updateMany({
          where: {
            macAddress: { in: activeMacs },
            status: { not: 'BLOCKED' }, // Don't update blocked users
          },
          data: { status: 'ONLINE' },
        });

        // Set users without active sessions to OFFLINE (except blocked)
        await this.prisma.user.updateMany({
          where: {
            macAddress: { notIn: activeMacs },
            status: 'ONLINE',
          },
          data: { status: 'OFFLINE' },
        });
      } else {
        // No active sessions, set all ONLINE users to OFFLINE
        await this.prisma.user.updateMany({
          where: { status: 'ONLINE' },
          data: { status: 'OFFLINE' },
        });
      }
    } catch (error) {
      this.logger.error(`❌ Failed to sync Mikrotik status: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Enrich user data with live Mikrotik session info
   * OPTIMIZED: Accept activeSessions as parameter to avoid duplicate query
   */
  private enrichUsersWithMikrotikData(users: User[], activeSessions: HotspotSessionRecord[]) {
    try {
      return users.map(user => {
        const session = activeSessions.find(s => {
          const sessionMac = String(s.mac || s['mac-address'] || '').toUpperCase();
          const userMac = (user.macAddress || '').toUpperCase();
          return sessionMac === userMac;
        });

        if (session) {
          const bytesIn = this.parseBytes(String(session['bytes-in'] ?? session.bytesIn ?? '0'));
          const bytesOut = this.parseBytes(String(session['bytes-out'] ?? session.bytesOut ?? '0'));
          
          return {
            ...user,
            status: 'ONLINE',
            ipAddress: session.address || session.ip || user.ipAddress,
            // Real-time session data from Mikrotik
            uptime: session.uptime || session['session-time-left'] || null,
            bytesIn,
            bytesOut,
            sessionTime: session['session-time-left'] || session.uptime || null,
            server: session.server || 'hotspot1',
            // Format for display
            quotaUsed: BigInt(bytesIn + bytesOut),
            username: session.user || session.username,
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
      });
    } catch (error) {
      this.logger.error(`❌ Failed to enrich users: ${getErrorMessage(error)}`);
      return users;
    }
  }

  /**
   * Parse bytes from Mikrotik format (e.g. "1.2MiB", "500KiB", "1234")
   */
  private parseBytes(value: string | number): number {
    if (typeof value === 'number') return value;
    if (!value) return 0;
    
    const str = value.toString();
    const match = str.match(/^([\d.]+)\s*(KiB|MiB|GiB|K|M|G|B)?$/i);
    if (!match) return parseInt(str) || 0;
    
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

  async findOnlineUsers() {
    try {
      // Get active sessions directly from Mikrotik (source of truth)
      const activeSessions = await this.mikrotikService.getActiveSessions();
      this.logger.log(`📊 Found ${activeSessions.length} active sessions in Mikrotik`);

      // Get MAC addresses
      const macAddresses = activeSessions
        .map(s => s.mac || s['mac-address'])
        .filter(Boolean)
        .map(mac => mac.toUpperCase());

      if (macAddresses.length === 0) {
        return [];
      }
      
      // Get users from database that match active sessions
      const users = await this.prisma.user.findMany({
        where: {
          macAddress: { in: macAddresses },
        },
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

      // Enrich with live Mikrotik data (reuse the activeSessions we already have)
      return this.enrichUsersWithMikrotikData(users, activeSessions);
    } catch (error) {
      this.logger.error('❌ Failed to fetch online users from Mikrotik:', error.message);
      return [];
    }
  }

  /**
   * Kick user from Mikrotik (disconnect active session)
   */
  async kickUser(id: string) {
    const user = await this.findById(id);
    
    if (!user.macAddress) {
      throw new NotFoundException('User has no MAC address');
    }

    try {
      // Get active session from Mikrotik by MAC
      const sessions = await this.mikrotikService.getActiveSessions();
      const session = sessions.find(s => {
        const sessionMac = (s.mac || s['mac-address'] || '').toUpperCase();
        return sessionMac === user.macAddress?.toUpperCase();
      });

      if (session) {
        // Disconnect user by username
        const username = session.user || session.username;
        if (username) {
          await this.mikrotikService.disconnectUser(username);
          this.logger.log(`✅ Kicked user ${username} (MAC: ${user.macAddress})`);
        }
      }

      // Update user status
      await this.prisma.user.update({
        where: { id },
        data: { status: 'OFFLINE' },
      });

      // Log action
      await this.prisma.systemLog.create({
        data: {
          action: 'USER_KICKED',
          type: LogType.ADMIN,
          description: `User ${user.phone} kicked`,
          metadata: {
            phone: user.phone,
            macAddress: user.macAddress,
          },
          ipAddress: 'system',
        },
      });

      return { message: 'User disconnected successfully' };
    } catch (error) {
      this.logger.error(`❌ Failed to kick user: ${error.message}`);
      throw error;
    }
  }

  async blockUser(id: string, reason?: string) {
    const user = await this.findById(id);

    // Block user
    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        status: 'BLOCKED',
      },
    });

    // Log action
    await this.prisma.systemLog.create({
      data: {
        action: 'USER_BLOCKED',
        type: LogType.ADMIN,
        description: `User ${user.phone} blocked`,
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
      },
    });

    // Log action
    await this.prisma.systemLog.create({
      data: {
        action: 'USER_UNBLOCKED',
        type: LogType.ADMIN,
        description: `User ${user.phone} unblocked`,
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

    // Delete sessions first (foreign key constraint)
    await this.prisma.session.deleteMany({
      where: { userId: id },
    });

    // Delete user
    await this.prisma.user.delete({
      where: { id },
    });

    // Log action
    await this.prisma.systemLog.create({
      data: {
        action: 'USER_DELETED',
        type: LogType.ADMIN,
        description: `User ${user.phone} deleted`,
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
