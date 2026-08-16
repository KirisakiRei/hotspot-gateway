import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/common/prisma.service';
import { LogType, Prisma, Setting } from '@prisma/client';
import { requireEnv } from '@/common/config/env';
import * as crypto from 'crypto';

@Injectable()
export class SettingService {
  private readonly algorithm = 'aes-256-cbc';
  private readonly key: Buffer;

  constructor(private prisma: PrismaService) {
    // Fail-fast: wajibkan ENCRYPTION_KEY eksplisit, tanpa fallback hardcoded
    const secret = requireEnv('ENCRYPTION_KEY');
    this.key = crypto.createHash('sha256').update(secret).digest();
  }

  private encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  private decrypt(text: string): string {
    try {
      // Check if the text looks like an encrypted value (has IV:encrypted format)
      if (!text || !text.includes(':')) {
        return text; // Return as-is if not encrypted format
      }
      const parts = text.split(':');
      if (parts.length < 2 || parts[0].length !== 32) {
        return text; // Not a valid encrypted format (IV should be 32 hex chars = 16 bytes)
      }
      const iv = Buffer.from(parts.shift()!, 'hex');
      if (iv.length !== 16) {
        return text; // Invalid IV length
      }
      const encryptedText = parts.join(':');
      const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
      let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      // If decryption fails, return the original value
      // This handles cases where value was stored unencrypted
      return text;
    }
  }

  async findAll(group?: string, opts?: { maskSecrets?: boolean }) {
    const where: Prisma.SettingWhereInput = group ? { group } : {};

    const settings = await this.prisma.setting.findMany({
      where,
      orderBy: [{ group: 'asc' }, { key: 'asc' }],
    });

    // Decrypt sensitive values
    return settings.map((setting) => ({
      ...setting,
      value: setting.isEncrypted ? this.decrypt(setting.value) : setting.value,
      ...(opts?.maskSecrets && setting.isEncrypted
        ? { value: '', hasValue: true }
        : {}),
    }));
  }

  async findByKey(key: string) {
    const setting = await this.prisma.setting.findUnique({
      where: { key },
    });

    if (!setting) {
      return null; // Return null instead of throwing error
    }

    return {
      ...setting,
      value: setting.isEncrypted ? this.decrypt(setting.value) : setting.value,
    };
  }

  async findByType(group: string) {
    return this.findAll(group);
  }

  async update(key: string, value: string, group?: string) {
    const setting = await this.prisma.setting.findUnique({
      where: { key },
    });

    // Use upsert if setting doesn't exist
    if (!setting) {
      const created = await this.prisma.setting.create({
        data: {
          key,
          value,
          group: group || 'voucher',
          type: 'JSON',
          isEncrypted: false,
        },
      });

      // Log action
      await this.prisma.systemLog.create({
        data: {
          action: 'SETTING_CREATED',
          type: LogType.ADMIN,
          description: `Setting ${key} created`,
          metadata: { key, group: created.group },
          ipAddress: 'system',
        },
      });

      return created;
    }

    // Jangan timpa secret dengan nilai kosong/mask dari klien
    if (setting.isEncrypted && (!value || value.trim() === '')) {
      return {
        ...setting,
        value: this.decrypt(setting.value),
      };
    }

    const updatedValue = setting.isEncrypted ? this.encrypt(value) : value;

    const updated = await this.prisma.setting.update({
      where: { key },
      data: {
        value: updatedValue,
      },
    });

    // Log action
    await this.prisma.systemLog.create({
      data: {
        action: 'SETTING_UPDATED',
        type: LogType.ADMIN,
        description: `Setting ${key} updated`,
        metadata: {
          key,
          group: updated.group,
        },
        ipAddress: 'system',
      },
    });

    return {
      ...updated,
      value: setting.isEncrypted ? value : updated.value,
    };
  }

  async updateMultiple(
    settings: Array<{ key: string; value: string }>,
  ) {
    const updates = await Promise.all(
      settings.map((s) => this.update(s.key, s.value)),
    );

    return updates;
  }

  async getMikrotikConfig() {
    const settings = await this.findByType('mikrotik');
    return this.reduceSettings(settings, 'mikrotik_');
  }

  async getPortalConfig() {
    const settings = await this.findByType('portal');
    return this.reduceSettings(settings, 'portal_');
  }

  private reduceSettings(
    settings: Array<Pick<Setting, 'key' | 'value'> & { value: string }>,
    prefix: string,
  ): Record<string, string> {
    return settings.reduce<Record<string, string>>((acc, setting) => {
      acc[setting.key.replace(prefix, '')] = setting.value;
      return acc;
    }, {});
  }
}
