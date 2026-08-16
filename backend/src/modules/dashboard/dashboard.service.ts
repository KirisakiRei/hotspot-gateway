import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/common/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getStats() {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // User Statistics
    const [
      totalUsers,
      onlineUsers,
      offlineUsers,
      blockedUsers,
      todayNewUsers,
      monthNewUsers,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { status: 'ONLINE' } }),
      this.prisma.user.count({ where: { status: 'OFFLINE' } }),
      this.prisma.user.count({ where: { status: 'BLOCKED' } }),
      this.prisma.user.count({
        where: { createdAt: { gte: startOfDay } },
      }),
      this.prisma.user.count({
        where: { createdAt: { gte: startOfMonth } },
      }),
    ]);

    // Voucher Statistics
    const [
      totalVouchers,
      unusedVouchers,
      activeVouchers,
      usedVouchers,
      expiredVouchers,
      todayRedeemed,
      monthRedeemed,
    ] = await Promise.all([
      this.prisma.voucher.count(),
      this.prisma.voucher.count({ where: { status: 'UNUSED' } }),
      this.prisma.voucher.count({ where: { status: 'ACTIVE' } }),
      this.prisma.voucher.count({ where: { status: 'USED' } }),
      this.prisma.voucher.count({ where: { status: 'EXPIRED' } }),
      this.prisma.voucher.count({
        where: {
          status: { in: ['ACTIVE', 'USED'] },
          activatedAt: { gte: startOfDay },
        },
      }),
      this.prisma.voucher.count({
        where: {
          status: { in: ['ACTIVE', 'USED'] },
          activatedAt: { gte: startOfMonth },
        },
      }),
    ]);

    // Advertisement Statistics
    const [
      totalAds,
      activeAds,
      totalViews,
      totalCompletions,
    ] = await Promise.all([
      this.prisma.advertisement.count(),
      this.prisma.advertisement.count({ where: { isActive: true } }),
      this.prisma.advertisement.aggregate({
        _sum: { views: true },
      }),
      this.prisma.advertisement.aggregate({
        _sum: { completions: true },
      }),
    ]);

    // Session Statistics
    const [activeSessions, todaySessions, monthSessions] = await Promise.all([
      this.prisma.session.count(),
      this.prisma.session.count({
        where: { startedAt: { gte: startOfDay } },
      }),
      this.prisma.session.count({
        where: { startedAt: { gte: startOfMonth } },
      }),
    ]);

    // Top Voucher Profiles
    const topProfiles = await this.prisma.voucherProfile.findMany({
      include: {
        _count: {
          select: { vouchers: true },
        },
      },
      orderBy: {
        vouchers: {
          _count: 'desc',
        },
      },
      take: 5,
    });

    // Recent Activity (last 7 days)
    const last7Days = new Date();
    last7Days.setDate(last7Days.getDate() - 7);

    const dailyStats = await this.prisma.$queryRaw<
      Array<{ date: string; users: bigint }>
    >`
      SELECT 
        DATE(createdAt) as date,
        COUNT(*) as users
      FROM users
      WHERE createdAt >= ${last7Days}
      GROUP BY DATE(createdAt)
      ORDER BY date ASC
    `;

    // Convert BigInt to Number for JSON serialization
    const dailyStatsFormatted = dailyStats.map(stat => ({
      date: stat.date,
      users: Number(stat.users),
    }));

    return {
      users: {
        total: totalUsers,
        online: onlineUsers,
        offline: offlineUsers,
        blocked: blockedUsers,
        today: todayNewUsers,
        month: monthNewUsers,
      },
      vouchers: {
        total: totalVouchers,
        unused: unusedVouchers,
        active: activeVouchers,
        used: usedVouchers,
        expired: expiredVouchers,
        todayRedeemed,
        monthRedeemed,
      },
      advertisements: {
        total: totalAds,
        active: activeAds,
        totalViews: Number(totalViews._sum?.views || 0),
        totalCompletions: Number(totalCompletions._sum?.completions || 0),
        completionRate:
          totalViews._sum?.views
            ? ((Number(totalCompletions._sum?.completions || 0)) /
                Number(totalViews._sum.views)) *
              100
            : 0,
      },
      sessions: {
        active: activeSessions,
        today: todaySessions,
        month: monthSessions,
      },
      topProfiles: topProfiles.map((profile) => ({
        id: profile.id,
        name: profile.name,
        voucherCount: profile._count.vouchers,
        price: Number(profile.price),
      })),
      activity: dailyStatsFormatted,
    };
  }

  async getRecentUsers(limit: number = 10) {
    return this.prisma.user.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        voucher: {
          select: {
            code: true,
            profile: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });
  }

  async getRecentVouchers(limit: number = 10) {
    return this.prisma.voucher.findMany({
      where: {
        status: { in: ['ACTIVE', 'USED'] },
        activatedAt: { not: null },
      },
      take: limit,
      orderBy: { activatedAt: 'desc' },
      include: {
        profile: {
          select: {
            name: true,
          },
        },
      },
    });
  }

  async getRecentLogs(limit: number = 20) {
    return this.prisma.systemLog.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        admin: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });
  }

  async getTopAdvertisements(limit: number = 5) {
    const ads = await this.prisma.advertisement.findMany({
      where: { isActive: true },
      take: limit,
      orderBy: [
        { views: 'desc' },
        { completions: 'desc' },
      ],
      select: {
        id: true,
        title: true,
        videoType: true,
        views: true,
        completions: true,
        priority: true,
      },
    });

    // Convert BigInt to Number for JSON serialization
    return ads.map(ad => ({
      ...ad,
      views: Number(ad.views),
      completions: Number(ad.completions),
    }));
  }
}
