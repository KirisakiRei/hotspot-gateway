// ==========================================
// WHATSAPP GATEWAY - Domain Logic
// Routing pesan, round-robin, template pool,
// log riwayat (WaMessageLog), dan konfigurasi.
// ==========================================

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/common/prisma.service';
import { SessionManager } from './session.manager';
import {
  buildVoucherMessage,
  formatDuration,
  resolvePublicPortalUrl,
} from './template.pool';
import {
  IncomingMessage,
  MessageLogStatus,
  MessageType,
  normalizePhone,
  SessionStatus,
} from './whatsapp.types';

export interface WhatsappConfig {
  enabled: boolean;
  roundRobinThreshold: number;
  autoReconnect: boolean;
}

export interface SessionRecord {
  id: string;
  phone: string;
  name: string | null;
  active: boolean;
  state: string;
  sentCount: number;
  paired: boolean;
  qrAvailable: boolean;
  pairedAt: Date | null;
  lastSeenAt: Date | null;
  lastError: string | null;
}

@Injectable()
export class WhatsappService implements OnModuleInit {
  private readonly logger = new Logger(WhatsappService.name);
  private readonly settingsKeys = {
    enabled: 'wa_enabled',
    roundRobinThreshold: 'wa_round_robin_threshold',
    autoReconnect: 'wa_auto_reconnect',
  } as const;

  constructor(
    private readonly prisma: PrismaService,
    private readonly manager: SessionManager,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.manager.onIncoming = (sessionPhone, message) => {
      this.handleIncoming(sessionPhone, message).catch((err) =>
        this.logger.error(`handleIncoming failed: ${err.message}`),
      );
    };
    const config = await this.getConfig();
    this.manager.setAutoReconnect(config.autoReconnect);
    this.logger.log(`Whatsapp gateway initialized (enabled=${config.enabled}, threshold=${config.roundRobinThreshold})`);
  }

  // ==========================================
  // CONFIG
  // ==========================================

  async getConfig(): Promise<WhatsappConfig> {
    const [enabledRaw, thresholdRaw, autoReconnectRaw] = await Promise.all([
      this.getSetting(this.settingsKeys.enabled),
      this.getSetting(this.settingsKeys.roundRobinThreshold),
      this.getSetting(this.settingsKeys.autoReconnect),
    ]);

    return {
      enabled: enabledRaw ? enabledRaw === 'true' : true,
      roundRobinThreshold: thresholdRaw ? parseInt(thresholdRaw, 10) || 5 : 5,
      autoReconnect: autoReconnectRaw ? autoReconnectRaw === 'true' : true,
    };
  }

  async updateConfig(config: Partial<WhatsappConfig>): Promise<WhatsappConfig> {
    const entries: Array<[string, string]> = [];
    if (config.enabled !== undefined) {
      entries.push([this.settingsKeys.enabled, String(config.enabled)]);
    }
    if (config.roundRobinThreshold !== undefined) {
      entries.push([this.settingsKeys.roundRobinThreshold, String(config.roundRobinThreshold)]);
    }
    if (config.autoReconnect !== undefined) {
      entries.push([this.settingsKeys.autoReconnect, String(config.autoReconnect)]);
    }

    for (const [key, value] of entries) {
      await this.prisma.setting.upsert({
        where: { key },
        create: { key, value, type: 'STRING', group: 'whatsapp' },
        update: { value },
      });
    }

    const next = await this.getConfig();
    this.manager.setAutoReconnect(next.autoReconnect);
    return next;
  }

  // ==========================================
  // SESSION MANAGEMENT (CRUD)
  // ==========================================

  async listSessions(): Promise<SessionRecord[]> {
    const rows = await this.prisma.waSession.findMany({ orderBy: { createdAt: 'asc' } });
    return rows.map((row) => {
      const runtime = this.manager.getSession(row.phone);
      return {
        id: row.id,
        phone: row.phone,
        name: row.name,
        active: row.active,
        state: runtime?.state || row.state,
        sentCount: runtime?.currentSentCount ?? row.sentCount,
        paired: runtime?.paired ?? false,
        qrAvailable: runtime?.qrAvailable ?? false,
        pairedAt: row.pairedAt,
        lastSeenAt: row.lastSeenAt,
        lastError: runtime?.currentLastError ?? null,
      };
    });
  }

  async addSession(phone: string, name?: string | null): Promise<SessionRecord> {
    const normalized = normalizePhone(phone);
    if (normalized.length < 8) {
      throw new Error('Nomor WhatsApp tidak valid');
    }

    await this.prisma.waSession.upsert({
      where: { phone: normalized },
      create: { phone: normalized, name: name || null },
      update: { name: name || null, active: true },
    });

    await this.manager.ensureSession({
      phone: normalized,
      name: name || null,
    });

    this.logger.log(`Session ${normalized} added/activated`);
    return (await this.listSessions()).find((s) => s.phone === normalized)!;
  }

  async updateSession(
    phone: string,
    data: { name?: string | null; active?: boolean },
  ): Promise<SessionRecord> {
    const normalized = normalizePhone(phone);
    const row = await this.prisma.waSession.update({
      where: { phone: normalized },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.active !== undefined ? { active: data.active } : {}),
      },
    });

    if (data.active === false) {
      await this.manager.stopSession(normalized);
    } else if (data.active === true) {
      await this.manager.connectSession(normalized);
    }

    return (await this.listSessions()).find((s) => s.phone === normalized)!;
  }

  async removeSession(phone: string): Promise<void> {
    const normalized = normalizePhone(phone);
    await this.manager.removeSession(normalized);
    await this.prisma.waSession.delete({ where: { phone: normalized } });
    this.logger.log(`Session ${normalized} removed`);
  }

  async connectSession(phone: string): Promise<SessionRecord> {
    const normalized = normalizePhone(phone);
    const row = await this.prisma.waSession.findUnique({ where: { phone: normalized } });
    if (!row) throw new Error('Sesi tidak ditemukan');

    await this.manager.connectSession(normalized);
    return (await this.listSessions()).find((s) => s.phone === normalized)!;
  }

  async logoutSession(phone: string): Promise<void> {
    const normalized = normalizePhone(phone);
    const client = this.manager.getSession(normalized);
    if (client) {
      await client.logout();
    }
    await this.prisma.waSession.update({
      where: { phone: normalized },
      data: { state: 'DISCONNECTED', pairedAt: null, sentCount: 0 },
    });
    this.logger.log(`Session ${normalized} logged out (re-pair required)`);
  }

  async getQr(phone: string): Promise<string | null> {
    const normalized = normalizePhone(phone);
    const client = this.manager.getSession(normalized);
    if (!client) return null;
    return client.getQrDataUrl();
  }

  // ==========================================
  // SEND (via round-robin sender)
  // ==========================================

  async sendText(recipient: string, message: string): Promise<boolean> {
    return this.sendWithRoundRobin({
      recipient,
      message,
      messageType: 'TEXT',
    });
  }

  async sendVoucher(
    recipient: string,
    voucherCode: string,
    profile: { name: string; duration: number; quota?: number; validityDays?: number },
  ): Promise<boolean> {
    const [portalRaw, envPortal] = await Promise.all([
      this.getSetting('portal_url'),
      Promise.resolve(this.configService.get<string>('FRONTEND_URL')),
    ]);

    const message = buildVoucherMessage({
      code: voucherCode,
      durationText: formatDuration(profile.duration),
      validityDays: profile.validityDays ?? 30,
      portalUrl: resolvePublicPortalUrl(portalRaw, envPortal),
    });

    return this.sendWithRoundRobin({
      recipient,
      message,
      messageType: 'VOUCHER',
      voucherCode,
    });
  }

  private async sendWithRoundRobin(input: {
    recipient: string;
    message: string;
    messageType: MessageType;
    voucherCode?: string;
  }): Promise<boolean> {
    const config = await this.getConfig();
    if (!config.enabled) {
      this.logger.warn('WhatsApp gateway disabled (wa_enabled=false), skip send');
      return false;
    }

    const recipient = normalizePhone(input.recipient);
    const sender = this.manager.selectSender({
      enabled: true,
      threshold: config.roundRobinThreshold,
    });

    if (!sender) {
      this.logger.warn('No connected WhatsApp session available, message queued as FAILED log');
      await this.createLog({
        sessionPhone: 'N/A',
        recipientPhone: recipient,
        messageType: input.messageType,
        message: input.message,
        voucherCode: input.voucherCode,
        status: 'FAILED',
        errorMessage: 'Tidak ada sesi WhatsApp yang terhubung',
      });
      return false;
    }

    const logId = await this.createLog({
      sessionPhone: sender.phone,
      recipientPhone: recipient,
      messageType: input.messageType,
      message: input.message,
      voucherCode: input.voucherCode,
      status: 'PENDING',
    });

    const result = await sender.sendText(recipient, input.message);

    if (result.ok) {
      await this.updateLogStatus(logId, 'SENT');
      await this.manager.incrementSent(sender.phone);
      this.logger.log(
        `[${input.messageType}] ${recipient} via sender ${sender.phone} (count=${sender.currentSentCount})`,
      );
      return true;
    }

    await this.updateLogStatus(logId, 'FAILED', result.error);
    return false;
  }

  // ==========================================
  // CONTACT / NUMBER CHECK
  // ==========================================

  private pickAnyConnectedClient() {
    return this.manager.getConnectedClients()[0] || null;
  }

  async checkNumber(phone: string): Promise<boolean> {
    const client = this.pickAnyConnectedClient();
    if (!client) return false;
    return client.checkNumber(normalizePhone(phone));
  }

  async getContactInfo(phone: string): Promise<{
    name: string | null;
    pushName: string | null;
    isWhatsApp: boolean;
  }> {
    const client = this.pickAnyConnectedClient();
    if (!client) {
      return { name: null, pushName: null, isWhatsApp: false };
    }
    return client.getContactInfo(normalizePhone(phone));
  }

  // ==========================================
  // INCOMING MESSAGES (handle conversation)
  // ==========================================

  private async handleIncoming(sessionPhone: string, message: IncomingMessage): Promise<void> {
    // Catat pesan masuk untuk audit log saja tanpa membalas chat
    await this.createLog({
      sessionPhone,
      recipientPhone: message.from,
      messageType: 'INCOMING',
      message: message.text,
      status: 'RECEIVED',
    });
  }

  // ==========================================
  // LOG (riwayat kirim/terima)
  // ==========================================

  async listLogs(params: {
    limit?: number;
    offset?: number;
    status?: string;
    sessionPhone?: string;
    recipientPhone?: string;
  }): Promise<{ rows: Array<Record<string, unknown>>; total: number }> {
    const limit = Math.min(Math.max(params.limit || 50, 1), 200);
    const offset = Math.max(params.offset || 0, 0);

    const where: Record<string, unknown> = {};
    if (params.status) where.status = params.status;
    if (params.sessionPhone) where.sessionPhone = normalizePhone(params.sessionPhone);
    if (params.recipientPhone) where.recipientPhone = normalizePhone(params.recipientPhone);

    const [rows, total] = await Promise.all([
      this.prisma.waMessageLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      this.prisma.waMessageLog.count({ where }),
    ]);

    return { rows, total };
  }

  private async createLog(data: {
    sessionPhone: string;
    recipientPhone: string;
    messageType: MessageType;
    message: string;
    voucherCode?: string;
    status: MessageLogStatus;
    errorMessage?: string;
  }): Promise<string> {
    const session = await this.prisma.waSession.findUnique({
      where: { phone: data.sessionPhone },
    });

    const created = await this.prisma.waMessageLog.create({
      data: {
        sessionId: session?.id ?? null,
        sessionPhone: data.sessionPhone,
        recipientPhone: data.recipientPhone,
        messageType: data.messageType,
        message: data.message.slice(0, 4000),
        voucherCode: data.voucherCode ?? null,
        status: data.status,
        errorMessage: data.errorMessage ?? null,
        ...(data.status === 'SENT' || data.status === 'RECEIVED' ? { sentAt: new Date() } : {}),
      },
    });
    return created.id;
  }

  private async updateLogStatus(id: string, status: MessageLogStatus, errorMessage?: string): Promise<void> {
    await this.prisma.waMessageLog.update({
      where: { id },
      data: {
        status,
        ...(errorMessage ? { errorMessage } : {}),
        ...(status === 'SENT' ? { sentAt: new Date() } : {}),
      },
    });
  }

  // ==========================================
  // STATUS / TEST
  // ==========================================

  async getStatus(): Promise<{
    connected: boolean;
    enabled: boolean;
    roundRobinThreshold: number;
    autoReconnect: boolean;
    sessions: SessionStatus[];
    totalSentToday: number;
  }> {
    const config = await this.getConfig();
    const sessions = this.manager.getStatuses().map((s) => ({
      ...s,
      name: null,
      active: true,
    }));

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const totalSentToday = await this.prisma.waMessageLog.count({
      where: { status: 'SENT', sentAt: { gte: startOfDay } },
    });

    return {
      connected: sessions.some((s) => s.state === 'CONNECTED'),
      enabled: config.enabled,
      roundRobinThreshold: config.roundRobinThreshold,
      autoReconnect: config.autoReconnect,
      sessions,
      totalSentToday,
    };
  }

  async test(): Promise<{ connected: boolean; detail: string }> {
    const status = await this.getStatus();
    const connectedCount = status.sessions.filter((s) => s.state === 'CONNECTED').length;
    return {
      connected: status.connected,
      detail: status.connected
        ? `${connectedCount} nomor terhubung`
        : 'Belum ada nomor terhubung',
    };
  }

  // ==========================================
  // HELPERS
  // ==========================================

  private async getSetting(key: string): Promise<string | null> {
    try {
      const setting = await this.prisma.setting.findUnique({ where: { key } });
      return setting?.value ?? null;
    } catch {
      return null;
    }
  }
}
