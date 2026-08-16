// ==========================================
// WHATSAPP GATEWAY - Session Manager (Transport)
// Mengelola lifecycle semua sesi (1 Baileys socket per nomor),
// sinkronisasi state ke DB, dan pemilihan round-robin.
// ==========================================

import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { join } from 'node:path';
import { PrismaService } from '@/common/prisma.service';
import { WaSessionClient } from './session.client';
import { IncomingMessage, SessionState, SessionStatus } from './whatsapp.types';

export interface RoundRobinConfig {
  enabled: boolean;
  threshold: number; // pesan per nomor sebelum rotasi
}

@Injectable()
export class SessionManager implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SessionManager.name);
  private sessions = new Map<string, WaSessionClient>();
  private authBaseDir: string;
  private autoReconnect = true;

  /** Hook untuk pesan masuk — di-set oleh WhatsappService. */
  onIncoming: ((sessionPhone: string, message: IncomingMessage) => void) | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    const configured = this.configService.get<string>('WA_AUTH_DIR');
    this.authBaseDir = configured && configured.trim() !== '' ? configured : join(process.cwd(), 'wa-auth');
  }

  async onModuleInit(): Promise<void> {
    let sessions: Array<{ phone: string; name: string | null; active: boolean }> = [];
    try {
      sessions = await this.prisma.waSession.findMany();
    } catch (err) {
      this.logger.warn(`wa_sessions table not ready (${err.message}) — auto-start skipped`);
      return;
    }

    for (const session of sessions) {
      if (!session.active) continue;
      this.logger.log(`Auto-starting session ${session.phone}${session.name ? ` (${session.name})` : ''}`);
      await this.ensureSession({
        phone: session.phone,
        name: session.name,
        onStateChange: (phone, state) => this.persistState(phone, state),
        onIncoming: (phone, msg) => this.onIncoming?.(phone, msg),
      });
    }
  }

  async onModuleDestroy(): Promise<void> {
    for (const client of this.sessions.values()) {
      await client.stop().catch(() => undefined);
    }
    this.sessions.clear();
  }

  // ==========================================
  // SESSION LIFECYCLE
  // ==========================================

  async ensureSession(input: {
    phone: string;
    name?: string | null;
    onStateChange?: (phone: string, state: SessionState) => void;
    onIncoming?: (phone: string, message: IncomingMessage) => void;
  }): Promise<WaSessionClient> {
    const existing = this.sessions.get(input.phone);
    if (existing) return existing;

    const client = new WaSessionClient({
      phone: input.phone,
      name: input.name,
      authBaseDir: this.authBaseDir,
      autoReconnect: this.autoReconnect,
      onStateChange: (phone, state) => {
        this.persistState(phone, state);
        input.onStateChange?.(phone, state);
        this.logger.log(`Session ${phone} -> ${state}`);
      },
      onIncoming: (phone, message) => {
        input.onIncoming?.(phone, message);
        this.onIncoming?.(phone, message);
      },
    });

    this.sessions.set(client.phone, client);

    client.start().catch((err) => {
      this.logger.error(`Failed to start session ${client.phone}: ${err.message}`);
    });

    return client;
  }

  /** Restart socket agar QR pairing baru muncul (setelah logout / disconnect). */
  async connectSession(phone: string): Promise<WaSessionClient> {
    const existing = this.sessions.get(phone);
    if (existing) {
      await existing.connect();
      return existing;
    }
    return this.ensureSession({
      phone,
      onStateChange: (sessionPhone, state) => this.persistState(sessionPhone, state),
      onIncoming: (sessionPhone, msg) => this.onIncoming?.(sessionPhone, msg),
    });
  }

  async removeSession(phone: string): Promise<void> {
    const client = this.sessions.get(phone);
    if (client) {
      await client.logout().catch(() => undefined);
      this.sessions.delete(phone);
    }
  }

  /** Stop socket tapi pertahankan entry di map (dipakai saat active=false). */
  async stopSession(phone: string): Promise<void> {
    const client = this.sessions.get(phone);
    if (client) {
      await client.stop().catch(() => undefined);
    }
  }

  getSession(phone: string): WaSessionClient | undefined {
    return this.sessions.get(phone);
  }

  /** Semua client yang sedang CONNECTED (untuk cek nomor / info kontak). */
  getConnectedClients(): WaSessionClient[] {
    return [...this.sessions.values()].filter((c) => c.state === 'CONNECTED');
  }

  hasSession(phone: string): boolean {
    return this.sessions.has(phone);
  }

  getStatuses(): SessionStatus[] {
    const statuses: SessionStatus[] = [];
    for (const client of this.sessions.values()) {
      statuses.push({
        phone: client.phone,
        name: null,
        active: true,
        state: client.state,
        paired: client.paired,
        qrAvailable: client.qrAvailable,
        sentCount: client.currentSentCount,
        pairedAt: null,
        lastSeenAt: null,
        lastError: client.currentLastError,
      });
    }
    return statuses;
  }

  /** Sinkronkan state runtime ke cache DB. */
  private async persistState(phone: string, state: SessionState): Promise<void> {
    await this.prisma.waSession
      .update({
        where: { phone },
        data: {
          state,
          ...(state === 'CONNECTED' ? { lastSeenAt: new Date() } : {}),
        },
      })
      .catch(() => undefined);

    if (state === 'CONNECTED') {
      // Tandai pairedAt hanya saat pertama kali berhasil (updateMany + filter null)
      await this.prisma.waSession
        .updateMany({
          where: { phone, pairedAt: null },
          data: { pairedAt: new Date() },
        })
        .catch(() => undefined);
    }
  }

  // ==========================================
  // ROUND-ROBIN SELECTION
  // ==========================================

  setAutoReconnect(value: boolean): void {
    this.autoReconnect = value;
  }

  /**
   * Pilih nomor pengirim dengan beban terkecil.
   * Semua sesi CONNECTED dengan sentCount >= threshold dianggap "penuh"
   * dan direset bersama agar giliran berputar merata.
   */
  selectSender(config: RoundRobinConfig): WaSessionClient | null {
    const connected = [...this.sessions.values()].filter((c) => c.state === 'CONNECTED');
    if (connected.length === 0) return null;

    if (!config.enabled || config.threshold <= 0) {
      // Tanpa rotasi: pilih yang sentCount terkecil (beban terendah)
      return connected.reduce((min, c) => (c.currentSentCount < min.currentSentCount ? c : min), connected[0]);
    }

    const allReachedThreshold = connected.every((c) => c.currentSentCount >= config.threshold);
    if (allReachedThreshold) {
      for (const c of connected) {
        this.resetSentCount(c);
      }
    }

    return connected.reduce((min, c) => (c.currentSentCount < min.currentSentCount ? c : min), connected[0]);
  }

  private async resetSentCount(client: WaSessionClient): Promise<void> {
    client.resetCounter();
    await this.prisma.waSession
      .update({ where: { phone: client.phone }, data: { sentCount: 0 } })
      .catch(() => undefined);
  }

  /** Naikkan counter sesi setelah berhasil kirim (memory sudah ditambah di client; sinkron DB). */
  async incrementSent(phone: string): Promise<void> {
    await this.prisma.waSession
      .update({
        where: { phone },
        data: { sentCount: { increment: 1 } },
      })
      .catch(() => undefined);
  }
}
