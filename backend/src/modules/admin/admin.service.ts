import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '@/common/prisma.service';
import { CreateAdminDto, UpdateAdminDto } from './dto/admin.dto';
import { Prisma } from '@prisma/client';
import type { RolePermissions } from '@/common/types/permissions';
import * as bcrypt from 'bcrypt';

// Default permissions for each role
const DEFAULT_PERMISSIONS = {
  SUPER_ADMIN: {
    dashboard: true,
    users: { view: true, create: true, edit: true, delete: true },
    vouchers: { view: true, create: true, edit: true, delete: true },
    ads: { view: true, create: true, edit: true, delete: true },
    router: { view: true, edit: true },
    logs: { view: true },
    settings: { view: true, edit: true },
  },
  ADMIN: {
    dashboard: true,
    users: { view: true, create: true, edit: true, delete: false },
    vouchers: { view: true, create: true, edit: true, delete: true },
    ads: { view: true, create: true, edit: true, delete: false },
    router: { view: true, edit: false },
    logs: { view: true },
    settings: { view: true, edit: false },
  },
  OPERATOR: {
    dashboard: true,
    users: { view: true, create: false, edit: false, delete: false },
    vouchers: { view: true, create: true, edit: false, delete: false },
    ads: { view: true, create: false, edit: false, delete: false },
    router: { view: false, edit: false },
    logs: { view: false },
    settings: { view: false, edit: false },
  },
};

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const admins = await this.prisma.admin.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return admins;
  }

  async findById(id: string) {
    const admin = await this.prisma.admin.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!admin) {
      throw new NotFoundException('Admin not found');
    }

    return admin;
  }

  async create(createDto: CreateAdminDto) {
    // Check if email exists
    const existing = await this.prisma.admin.findUnique({
      where: { email: createDto.email },
    });

    if (existing) {
      throw new ConflictException('Email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(createDto.password, 10);

    const admin = await this.prisma.admin.create({
      data: {
        email: createDto.email,
        password: hashedPassword,
        name: createDto.name,
        role: createDto.role,
        isActive: createDto.isActive ?? true,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    return admin;
  }

  async update(id: string, updateDto: UpdateAdminDto) {
    const admin = await this.findById(id);

    // Check if updating email to one that already exists
    if (updateDto.email && updateDto.email !== admin.email) {
      const existing = await this.prisma.admin.findUnique({
        where: { email: updateDto.email },
      });

      if (existing) {
        throw new ConflictException('Email already exists');
      }
    }

    const data: Prisma.AdminUpdateInput = {
      email: updateDto.email,
      name: updateDto.name,
      role: updateDto.role,
      isActive: updateDto.isActive,
    };

    if (updateDto.password) {
      data.password = await bcrypt.hash(updateDto.password, 10);
    }

    const updated = await this.prisma.admin.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return updated;
  }

  async delete(id: string) {
    const admin = await this.findById(id);

    // Prevent deleting last super admin
    if (admin.role === 'SUPER_ADMIN') {
      const superAdminCount = await this.prisma.admin.count({
        where: { role: 'SUPER_ADMIN' },
      });

      if (superAdminCount <= 1) {
        throw new BadRequestException('Cannot delete the last super admin');
      }
    }

    await this.prisma.admin.delete({
      where: { id },
    });
  }

  // ==========================================
  // ROLE PERMISSIONS
  // ==========================================

  async getRolePermissions() {
    // Try to get custom permissions from settings
    const settings = await this.prisma.setting.findMany({
      where: {
        key: {
          startsWith: 'role_permissions_',
        },
      },
    });

    const roles = ['SUPER_ADMIN', 'ADMIN', 'OPERATOR'];
    const result = [];

    for (const roleId of roles) {
      const setting = settings.find((s) => s.key === `role_permissions_${roleId}`);
      let permissions;

      if (setting) {
        try {
          permissions = JSON.parse(setting.value);
        } catch {
          permissions = DEFAULT_PERMISSIONS[roleId as keyof typeof DEFAULT_PERMISSIONS];
        }
      } else {
        permissions = DEFAULT_PERMISSIONS[roleId as keyof typeof DEFAULT_PERMISSIONS];
      }

      // Count admins with this role
      const userCount = await this.prisma.admin.count({
        where: { role: roleId },
      });

      result.push({
        id: roleId,
        name: roleId.replace('_', ' '),
        permissions,
        userCount,
      });
    }

    // Get custom roles
    const customRoleSettings = settings.filter(
      (s) => !['SUPER_ADMIN', 'ADMIN', 'OPERATOR'].includes(s.key.replace('role_permissions_', '')),
    );

    for (const setting of customRoleSettings) {
      const roleId = setting.key.replace('role_permissions_', '');
      try {
        const data = JSON.parse(setting.value);
        result.push({
          id: roleId,
          name: data.name || roleId,
          permissions: data.permissions || {},
          userCount: 0,
          isCustom: true,
        });
      } catch {
        // Skip invalid entries
      }
    }

    return result;
  }

  async updateRolePermissions(role: string, permissions: RolePermissions) {
    const key = `role_permissions_${role}`;

    // Check if setting exists
    const existing = await this.prisma.setting.findUnique({
      where: { key },
    });

    if (existing) {
      await this.prisma.setting.update({
        where: { key },
        data: {
          value: JSON.stringify(permissions),
        },
      });
    } else {
      await this.prisma.setting.create({
        data: {
          key,
          value: JSON.stringify(permissions),
          type: 'JSON',
          group: 'permissions',
          description: `Permissions for role ${role}`,
        },
      });
    }

    return { role, permissions };
  }

  async createRole(data: { id: string; name: string; permissions: RolePermissions }) {
    const key = `role_permissions_${data.id}`;

    // Check if role already exists
    const existing = await this.prisma.setting.findUnique({
      where: { key },
    });

    if (existing) {
      throw new ConflictException('Role already exists');
    }

    // For built-in roles, just store permissions
    // For custom roles, we would need a different approach
    await this.prisma.setting.create({
      data: {
        key,
        value: JSON.stringify({
          name: data.name,
          permissions: data.permissions,
        }),
        type: 'JSON',
        group: 'permissions',
        description: `Permissions for role ${data.name}`,
      },
    });

    return data;
  }

  async deleteRole(role: string) {
    // Prevent deleting built-in roles
    if (['SUPER_ADMIN', 'ADMIN', 'OPERATOR'].includes(role)) {
      throw new BadRequestException('Cannot delete built-in roles');
    }

    const key = `role_permissions_${role}`;

    await this.prisma.setting.delete({
      where: { key },
    });
  }
}
