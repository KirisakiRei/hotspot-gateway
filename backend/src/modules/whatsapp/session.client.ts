// ==========================================
// WHATSAPP GATEWAY - Transport Layer
// Satu instance = satu nomor WhatsApp (single Baileys socket).
// Tanggung jawab: koneksi, QR, FSM, auto-reconnect, typing/seen, kirim.
// ==========================================

import {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  Browsers,
  fetchLatestBaileysVersion,
  type WASocket,
  type BaileysEventMap,
} from '@whiskeysockets/baileys';
import { toDataURL } from 'qrcode';
import { pino, type Logger } from 'pino';
import { join } from 'node:path';
import { rm } from 'node:fs/promises';
import { Logger as NestLogger } from '@nestjs/common';
import {
  SessionState,
  IncomingMessage,
  SendResult,
  normalizePhone,
  toJid,
  fromJid,
} from './whatsapp.types';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function extractDisconnectStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const output = (error as { output?: { statusCode?: unknown } }).output;
  return typeof output?.statusCode === 'number' ? output.statusCode : undefined;
}

export interface WaSessionClientOptions {
  phone: string;
  name?: string | null;
  authBaseDir: string;
  autoReconnect: boolean;
  /** Dipanggil saat state berubah (untuk sync cache DB + event). */
  onStateChange?: (phone: string, state: SessionState) => void;
  /** Dipanggil saat ada pesan masuk dari user. */
  onIncoming?: (phone: string, message: IncomingMessage) => void;
}

const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_BASE_DELAY_MS = 2000;
const RESTART_REQUIRED_DELAY_MS = 800;

export class WaSessionClient {
  readonly phone: string;
  private readonly logger: Logger;
  private readonly nestLogger: NestLogger;

  private authDir: string;
  private opts: WaSessionClientOptions;
  private sock: WASocket | null = null;
  private _state: SessionState = 'DISCONNECTED';
  private _paired = false;
  private qr: string | null = null;
  private lastError: string | null = null;
  private sentCount = 0;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private closing = false;
  private starting = false;
  private socketGeneration = 0;
  private contactCache = new Map<string, { name?: string; notify?: string; verifiedName?: string }>();

  constructor(opts: WaSessionClientOptions) {
    this.opts = opts;
    this.phone = normalizePhone(opts.phone);
    this.nestLogger = new NestLogger(`WaSession:${this.phone}`);
    this.authDir = join(opts.authBaseDir, this.phone);
    this.logger = pino({ level: 'silent' });
  }

  get state(): SessionState {
    return this._state;
  }

  get paired(): boolean {
    return this._paired;
  }

  get qrAvailable(): boolean {
    return this.qr !== null;
  }

  get currentSentCount(): number {
    return this.sentCount;
  }

  /** Reset counter round-robin (dipanggil manager saat rotasi). */
  resetCounter(): void {
    this.sentCount = 0;
  }

  get currentLastError(): string | null {
    return this.lastError;
  }

  get socket(): WASocket | null {
    return this.sock;
  }

  // ==========================================
  // LIFECYCLE
  // ==========================================

  async start(): Promise<void> {
    if (this.sock || this.starting) return;

    this.starting = true;
    this.closing = false;

    try {
      const { state: authState, saveCreds } = await useMultiFileAuthState(this.authDir);
      const { version } = await fetchLatestBaileysVersion();

      this.setState('CONNECTING');
      const generation = ++this.socketGeneration;
      this.sock = makeWASocket({
        version,
        auth: authState,
        logger: this.logger,
        browser: Browsers.ubuntu('Chrome'),
        markOnlineOnConnect: false,
        printQRInTerminal: false,
        syncFullHistory: false,
        connectTimeoutMs: 30_000,
        defaultQueryTimeoutMs: 30_000,
        keepAliveIntervalMs: 15_000,
      });

      this.sock.ev.on('creds.update', saveCreds);

      this.sock.ev.on('connection.update', (update) => {
        if (generation !== this.socketGeneration) return;
        this.handleConnectionUpdate(update).catch((err) =>
          this.nestLogger.error(`connection.update handler error: ${err.message}`),
        );
      });

      this.sock.ev.on('contacts.upsert', (contacts) => {
        for (const c of contacts) {
          if (c.id) this.contactCache.set(c.id, c);
        }
      });

      this.sock.ev.on('messages.upsert', (upsert) => {
        this.handleMessagesUpsert(upsert).catch((err) =>
          this.nestLogger.error(`messages.upsert handler error: ${err.message}`),
        );
      });

      this.nestLogger.log('Baileys socket initialized');
    } catch (err) {
      this.lastError = err.message;
      this.setClosureState();
      this.nestLogger.error(`start failed: ${err.message}`);
      throw err;
    } finally {
      this.starting = false;
    }
  }

  /**
   * Tutup socket lama lalu buat socket baru.
   * Dipakai setelah scan QR (kode 515) dan saat tombol Connect ditekan ulang.
   */
  async restart(): Promise<void> {
    this.closing = false;
    this.clearReconnectTimer();
    await this.endSocket();
    this.qr = null;
    this.setState('CONNECTING');
    await sleep(300);
    await this.start();
  }

  /**
   * Mulai pairing dari UI. Jika sudah CONNECTED, tidak melakukan apa-apa.
   * Selain itu selalu restart agar QR baru muncul setelah logout/disconnect.
   */
  async connect(): Promise<void> {
    if (this._state === 'CONNECTED') return;
    this.reconnectAttempts = 0;
    this.lastError = null;
    await this.restart();
  }

  async stop(): Promise<void> {
    this.closing = true;
    this.clearReconnectTimer();
    await this.endSocket();
    this.qr = null;
    this.setClosureState();
    this.closing = false;
  }

  /** Hapus kredensial + tutup socket (logout permanen dari nomor ini). */
  async logout(): Promise<void> {
    this.closing = true;
    this.clearReconnectTimer();
    this.socketGeneration += 1;
    const sock = this.sock;
    this.sock = null;
    if (sock) {
      try {
        await sock.logout();
      } catch {
        /* ignore */
      }
      this.disposeSocket(sock);
    }
    this.qr = null;
    this._paired = false;
    this.sentCount = 0;
    this.reconnectAttempts = 0;
    this.lastError = null;
    this.setClosureState();
    await rm(this.authDir, { recursive: true, force: true }).catch(() => undefined);
    this.closing = false;
    this.nestLogger.log('Session logged out, auth removed');
  }

  // ==========================================
  // QR
  // ==========================================

  async getQrDataUrl(): Promise<string | null> {
    if (!this.qr) return null;
    return toDataURL(this.qr);
  }

  // ==========================================
  // SEND (typing -> message -> paused)
  // ==========================================

  async sendText(phone: string, message: string): Promise<SendResult> {
    const sock = this.sock;
    if (!sock || this._state !== 'CONNECTED') {
      return { ok: false, error: 'Session tidak terhubung' };
    }

    const jid = toJid(phone);
    const typingDelay = 500 + Math.floor(Math.random() * 700);

    try {
      // Typing indicator agar terkesan natural
      await sock.sendPresenceUpdate('composing', jid).catch(() => undefined);
      await sleep(typingDelay);

      const sent = await sock.sendMessage(jid, { text: message });
      await sock.sendPresenceUpdate('paused', jid).catch(() => undefined);

      // Mark as read pada chat (seen) — pesan keluar ikut terlihat "dibaca"
      const messageId = sent?.key?.id;
      if (messageId) {
        await sock.readMessages([{ remoteJid: jid, id: messageId }]).catch(() => undefined);
      }

      this.sentCount += 1;
      this.nestLogger.log(`Message sent to ${phone}`);
      return { ok: true, messageId: messageId ?? undefined };
    } catch (err) {
      this.lastError = err.message;
      this.nestLogger.error(`sendText failed to ${phone}: ${err.message}`);
      return { ok: false, error: err.message };
    }
  }

  // ==========================================
  // CONTACT / NUMBER
  // ==========================================

  async checkNumber(phone: string): Promise<boolean> {
    const sock = this.sock;
    if (!sock || this._state !== 'CONNECTED') return false;
    try {
      const jid = toJid(phone);
      const results = await sock.onWhatsApp(jid);
      return results?.some((r) => r.exists) ?? false;
    } catch (err) {
      this.nestLogger.warn(`checkNumber failed for ${phone}: ${err.message}`);
      return false;
    }
  }

  async getContactInfo(phone: string): Promise<{
    name: string | null;
    pushName: string | null;
    isWhatsApp: boolean;
  }> {
    const sock = this.sock;
    if (!sock || this._state !== 'CONNECTED') {
      return { name: null, pushName: null, isWhatsApp: false };
    }

    try {
      const jid = toJid(phone);
      const exists = (await sock.onWhatsApp(jid))?.some((r) => r.exists) ?? false;

      const cached = this.contactCache.get(jid);
      const name = cached?.name || cached?.verifiedName || null;
      const pushName = cached?.notify || null;

      return { name, pushName, isWhatsApp: exists };
    } catch (err) {
      this.nestLogger.warn(`getContactInfo failed for ${phone}: ${err.message}`);
      return { name: null, pushName: null, isWhatsApp: false };
    }
  }

  // ==========================================
  // INTERNAL: connection handling
  // ==========================================

  private async handleConnectionUpdate(
    update: BaileysEventMap['connection.update'],
  ): Promise<void> {
    if (update.qr) {
      this.qr = update.qr;
      this.lastError = null;
      this.setState('CONNECTING');
      return;
    }

    if (update.connection === 'connecting') {
      this.lastError = null;
      this.setState('CONNECTING');
      return;
    }

    if (update.connection === 'open') {
      this.qr = null;
      this._paired = true;
      this.lastError = null;
      this.reconnectAttempts = 0;
      this.clearReconnectTimer();
      this.nestLogger.log('WhatsApp session established and paired');
      this.setState('CONNECTED');
      return;
    }

    if (update.connection === 'close') {
      const statusCode = extractDisconnectStatus(update.lastDisconnect?.error);
      const reason = this.describeDisconnect(statusCode);
      this.nestLogger.warn(`Connection closed: ${reason} (code ${statusCode})`);

      this.qr = null;
      await this.endSocket();

      if (this.closing) {
        this.setClosureState();
        return;
      }

      // Kode 515: handshake pairing selesai, WhatsApp minta socket baru.
      // Kredensial sudah tersimpan, jadi restart segera tanpa menghapus auth.
      if (statusCode === DisconnectReason.restartRequired) {
        this.nestLogger.log('WhatsApp requested socket restart after pairing (code 515)');
        this.reconnectAttempts = 0;
        this.lastError = null;
        this.scheduleReconnect(RESTART_REQUIRED_DELAY_MS, false);
        return;
      }

      const fatalReasons = [
        DisconnectReason.loggedOut,
        DisconnectReason.badSession,
        DisconnectReason.multideviceMismatch,
      ];
      if (statusCode !== undefined && fatalReasons.includes(statusCode)) {
        this._paired = false;
        this.sentCount = 0;
        this.lastError = `Session terminated: ${reason}`;
        this.nestLogger.error(`Permanent disconnect detected. Re-pairing required: ${reason}`);
        await rm(this.authDir, { recursive: true, force: true }).catch(() => undefined);
        this.setClosureState();
        return;
      }

      if (this.opts.autoReconnect) {
        this.scheduleReconnect();
        return;
      }

      this.setClosureState();
    }
  }

  private describeDisconnect(statusCode: number | undefined): string {
    switch (statusCode) {
      case DisconnectReason.loggedOut:
        return 'loggedOut (dilogout dari device lain)';
      case DisconnectReason.connectionClosed:
        return 'connectionClosed';
      case DisconnectReason.connectionLost:
        return 'connectionLost';
      case DisconnectReason.connectionReplaced:
        return 'connectionReplaced (terbuka di device lain)';
      case DisconnectReason.timedOut:
        return 'timedOut';
      case DisconnectReason.badSession:
        return 'badSession (kredensial korup)';
      case DisconnectReason.restartRequired:
        return 'restartRequired (server minta restart)';
      case DisconnectReason.multideviceMismatch:
        return 'multideviceMismatch';
      default:
        return statusCode ? `unknown (${statusCode})` : 'manual close';
    }
  }

  private scheduleReconnect(delayMs = RECONNECT_BASE_DELAY_MS, countAttempt = true): void {
    if (this.reconnectTimer || this.closing) return;

    if (countAttempt) {
      if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        this.nestLogger.error('Reconnect attempts exhausted, session offline');
        this.lastError = 'Gagal reconnect setelah beberapa percobaan';
        this.setClosureState();
        return;
      }
      this.reconnectAttempts += 1;
      this.lastError = `Reconnect percobaan ${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}`;
    }

    this.nestLogger.log(`Scheduling reconnect in ${delayMs}ms`);
    this.setState('CONNECTING');

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      try {
        await this.restart();
      } catch (err) {
        this.nestLogger.error(`Reconnect failed: ${err.message}`);
        this.lastError = err.message;
        this.scheduleReconnect();
      }
    }, delayMs);
  }

  private async endSocket(): Promise<void> {
    this.socketGeneration += 1;
    const sock = this.sock;
    this.sock = null;
    if (!sock) return;
    this.disposeSocket(sock);
  }

  private disposeSocket(sock: WASocket): void {
    try {
      sock.ev.removeAllListeners('connection.update');
      sock.ev.removeAllListeners('creds.update');
      sock.ev.removeAllListeners('contacts.upsert');
      sock.ev.removeAllListeners('messages.upsert');
    } catch {
      /* ignore */
    }
    try {
      sock.end(undefined);
    } catch {
      /* ignore */
    }
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private async handleMessagesUpsert(
    upsert: BaileysEventMap['messages.upsert'],
  ): Promise<void> {
    if (upsert.type !== 'notify') return;

    for (const msg of upsert.messages) {
      if (!msg.message || msg.key?.fromMe) continue;

      const jid = msg.key.remoteJid;
      const from = fromJid(jid);
      if (!from) continue;

      const text =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        msg.message.imageMessage?.caption ||
        '';

      // Cache nama pengirim jika tersedia
      if (msg.pushName && jid) {
        const existing = this.contactCache.get(jid) || {};
        this.contactCache.set(jid, { ...existing, notify: msg.pushName });
      }

      // Nonaktifkan auto-read (centang biru) otomatis agar tidak mengganggu WhatsApp pribadi
      // Pesan masuk dicatat untuk log internal
      this.nestLogger.log(`Incoming message from ${from}: ${text.slice(0, 80)}`);
      this.opts.onIncoming?.(this.phone, { from, text, messageId: msg.key.id || '' });
    }
  }

  private setState(state: SessionState): void {
    if (this._state === state) return;
    this._state = state;
    this.opts.onStateChange?.(this.phone, state);
  }

  private setClosureState(): void {
    this.sock = null;
    this.qr = null;
    this.setState('DISCONNECTED');
  }
}
