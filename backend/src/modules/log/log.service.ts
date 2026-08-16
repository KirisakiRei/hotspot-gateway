import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/common/prisma.service';
import { LogType, Prisma } from '@prisma/client';
import type { JsonValue } from '@/common/types/json';

const LOG_TYPES = new Set<string>(Object.values(LogType));

function toLogType(value: string): LogType | undefined {
  return LOG_TYPES.has(value) ? (value as LogType) : undefined;
}

@Injectable()
export class LogService {
  constructor(private prisma: PrismaService) {}

  async findAll(filters?: {
    action?: string;
    type?: string;
    adminId?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }) {
    const {
      action,
      type,
      adminId,
      startDate,
      endDate,
      page = 1,
      limit = 50,
    } = filters || {};
    const skip = (page - 1) * limit;

    const where: Prisma.SystemLogWhereInput = {};

    if (action) {
      where.action = action;
    }

    if (type) {
      const parsed = toLogType(type);
      if (parsed) where.type = parsed;
    }

    if (adminId) {
      where.adminId = adminId;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = startDate;
      }
      if (endDate) {
        where.createdAt.lte = endDate;
      }
    }

    const [logs, total] = await Promise.all([
      this.prisma.systemLog.findMany({
        where,
        skip,
        take: limit,
        include: {
          admin: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.systemLog.count({ where }),
    ]);

    return {
      data: logs,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string) {
    return this.prisma.systemLog.findUnique({
      where: { id },
      include: {
        admin: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  async getActions() {
    const logs = await this.prisma.systemLog.findMany({
      select: { action: true },
      distinct: ['action'],
      orderBy: { action: 'asc' },
    });

    return logs.map((log) => log.action);
  }

  async getEntities() {
    const logs = await this.prisma.systemLog.findMany({
      select: { type: true },
      distinct: ['type'],
      orderBy: { type: 'asc' },
    });

    return logs.map((log) => log.type);
  }

  async create(data: {
    action: string;
    type: string;
    adminId?: string;
    userId?: string;
    description?: string;
    details?: JsonValue;
    ipAddress?: string;
    macAddress?: string;
  }) {
    const parsedType = toLogType(data.type) ?? LogType.SYSTEM;
    return this.prisma.systemLog.create({
      data: {
        action: data.action,
        type: parsedType,
        adminId: data.adminId,
        userId: data.userId,
        description: data.description,
        metadata: data.details || {},
        ipAddress: data.ipAddress,
        macAddress: data.macAddress,
      },
    });
  }

  async deleteOldLogs(daysToKeep: number = 90) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await this.prisma.systemLog.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
      },
    });

    return {
      message: `Deleted ${result.count} logs older than ${daysToKeep} days`,
      deleted: result.count,
    };
  }
}
