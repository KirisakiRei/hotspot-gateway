import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RouterOSClient } from 'routeros-client';
import { RouterOSAPI } from 'node-routeros';
import { PrismaService } from '@/common/prisma.service';
import { requireEnv } from '@/common/config/env';
import { getErrorMessage } from '@/common/utils/error';
import {
  extractRouterOsApi,
  getRouterOsCode,
  type MikrotikRecord,
  type RosApiMenu,
  type RouterOsClientInternals,
} from './mikrotik.types';
import * as crypto from 'crypto';

// Semaphore sederhana untuk membatasi operasi konkuren (bukan mutex penuh)
class Semaphore {
  private permits: number;
  private waitQueue: (() => void)[] = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }
    await new Promise<void>((resolve) => this.waitQueue.push(resolve));
  }

  release(): void {
    const next = this.waitQueue.shift();
    if (next) {
      next();
    } else {
      this.permits++;
    }
  }
}

/**
 * MikrotikConnectionManager
 *
 * Mengelola seluruh lifecycle koneksi RouterOS (query + stream):
 * - Koneksi lazy + retry/backoff + connection lock
 * - Keep-alive berkala
 * - Serialisasi operasi (semaphore + queue)
 * - Timeout protection pada setiap perintah
 * - Fondasi untuk multi-router: state per-koneksi di sini,
 *   nanti tinggal dijadikan Map<routerId, ConnectionState>.
 */
@Injectable()
export class MikrotikConnectionManager implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MikrotikConnectionManager.name);

  // ==========================================
  // DUAL CONNECTION STRATEGY
  // queryApi: RouterOSClient wrapper for CRUD operations
  // streamApi: RouterOSClient wrapper for streaming/listen operations
  // ==========================================
  private queryApi: RouterOSClient | null = null;
  private streamApi: RouterOSClient | null = null;
  private queryClient: RouterOSAPI | null = null;
  private streamClient: RouterOSAPI | null = null;
  private queryMenu: RosApiMenu | null = null;
  private streamMenu: RosApiMenu | null = null;

  private isConnected = false;
  private isStreamConnected = false;
  private connectionRetries = 0;
  private maxRetries = 3;
  private keepAliveInterval: NodeJS.Timeout | null = null;
  private connectionLock = false;
  private streamConnectionLock = false;
  private lastActivity = Date.now();
  private operationQueue: Promise<unknown> = Promise.resolve();

  // Serialisasi operasi Mikrotik (1 permit = serial penuh)
  private readonly semaphore = new Semaphore(1);
  private pendingOperations = 0;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {}

  // ==========================================
  // PUBLIC ACCESSORS (read-only untuk service lain)
  // ==========================================

  get isQueryConnected(): boolean {
    return this.isConnected;
  }

  get isStreamConnectedFlag(): boolean {
    return this.isStreamConnected;
  }

  get queryApiClient(): RouterOSClient | null {
    return this.queryApi;
  }

  get streamApiClient(): RouterOSClient | null {
    return this.streamApi;
  }

  get client(): RouterOSAPI | null {
    return this.queryClient;
  }

  get streamClientApi(): RouterOSAPI | null {
    return this.streamClient;
  }

  get queryMenuApi(): RosApiMenu | null {
    return this.queryMenu;
  }

  get streamMenuApi(): RosApiMenu | null {
    return this.streamMenu;
  }

  get lastActivityAt(): number {
    return this.lastActivity;
  }

  // ==========================================
  // LIFECYCLE
  // ==========================================

  async onModuleInit() {
    // Direct RADIUS tidak menggunakan RouterOS API. Jangan auto-connect ke
    // API 8728 yang sengaja dimatikan; koneksi manual legacy tetap tersedia.
    this.logger.log('RouterOS API auto-connect disabled (Direct RADIUS mode).');
  }

  async onModuleDestroy() {
    this.stopKeepAlive();
    await this.disconnect();
  }

  private async connectWithTimeout(timeoutMs: number): Promise<boolean> {
    let timer: NodeJS.Timeout | null = null;
    try {
      return await Promise.race([
        this.connect(),
        new Promise<boolean>((resolve) => {
          timer = setTimeout(() => resolve(false), timeoutMs);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  // ==========================================
  // CONNECTION MANAGEMENT
  // ==========================================

  async connect(): Promise<boolean> {
    // Prevent concurrent connection attempts
    if (this.connectionLock) {
      this.logger.debug('Connection attempt already in progress, waiting...');
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return this.isConnected;
    }

    this.connectionLock = true;

    try {
      const { host, port, username, password } = await this.getConnectionConfig();

      this.logger.log(`Connecting to Mikrotik: ${host}:${port} as ${username}`);

      // Disconnect existing API first
      if (this.queryApi) {
        try {
          await this.queryApi.close();
        } catch (e) {
          // Ignore close errors
        }
        this.queryApi = null;
        this.queryClient = null;
        this.isConnected = false;
      }

      // Create RouterOSClient instance
      this.queryApi = new RouterOSClient({
        host,
        user: username,
        password,
        port,
        timeout: 5, // 5 seconds connection timeout (fail-fast agar tidak memblokir HTTP request web)
        keepalive: true,
      });

      // RouterOSClient.connect() returns RosApiMenu which wraps RouterOSAPI
      const connectedMenu = (await Promise.race([
        this.queryApi.connect(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Connection timeout (5s)')), 5000),
        ),
      ])) as RosApiMenu;

      // Store both wrapper and underlying API
      this.queryMenu = connectedMenu;
      this.queryClient = extractRouterOsApi(connectedMenu);

      if (!this.queryClient) {
        throw new Error('Failed to get RouterOS API instance');
      }

      // CRITICAL FIX: Patch channel to handle !empty responses gracefully
      this.patchChannelForEmptyResponses();

      // Setup error handlers on the underlying RouterOSAPI
      if (this.queryClient && this.queryClient.on) {
        this.queryClient.on('error', (error: Error) => {
          this.logger.error(`RouterOS socket error: ${error.message} (errno: ${getRouterOsCode(error)})`);
          const code = getRouterOsCode(error);
          if (
            code === -4077 ||
            code === 'SOCKTMOUT' ||
            code === 'ECONNRESET' ||
            code === 'ETIMEDOUT' ||
            code === 'EPIPE'
          ) {
            this.isConnected = false;
            this.logger.warn('Connection marked as disconnected due to socket error');
          }
        });

        this.queryClient.on('close', () => {
          this.logger.warn('RouterOS connection closed');
          this.isConnected = false;
        });

        this.queryClient.on('timeout', () => {
          this.logger.warn('RouterOS connection timeout');
          this.isConnected = false;
        });
      }

      this.isConnected = true;
      this.connectionRetries = 0; // Reset retries on success
      this.lastActivity = Date.now();

      this.logger.log(`Connected to Mikrotik at ${host}:${port}`);

      // Start keep-alive if not already running
      if (!this.keepAliveInterval) {
        this.startKeepAlive();
      }

      return true;
    } catch (error: unknown) {
      this.logger.error(`Failed to connect to Mikrotik: ${getErrorMessage(error)}`);
      this.isConnected = false;
      this.queryApi = null;
      this.queryClient = null;

      // Retry logic: max 1 retry with fast backoff
      if (this.connectionRetries < 1) {
        this.connectionRetries++;
        this.logger.log(`Retrying Mikrotik connection (${this.connectionRetries}/1)...`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        this.connectionLock = false; // Release lock for retry
        return this.connect();
      }

      return false;
    } finally {
      this.connectionLock = false;
    }
  }

  async connectStreamClient(): Promise<boolean> {
    if (this.streamConnectionLock) {
      this.logger.debug('Stream connection attempt already in progress...');
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return this.isStreamConnected;
    }

    this.streamConnectionLock = true;

    try {
      const { host, port, username, password } = await this.getConnectionConfig();

      this.logger.log(`Connecting stream client to Mikrotik: ${host}:${port}`);

      // Close existing stream API if any
      if (this.streamApi) {
        try {
          await this.streamApi.close();
        } catch (e) {
          // Ignore
        }
        this.streamApi = null;
        this.streamClient = null;
        this.isStreamConnected = false;
      }

      // Create new RouterOSClient for streaming
      this.streamApi = new RouterOSClient({
        host,
        user: username,
        password,
        port,
        timeout: 0, // No timeout for streaming - persistent connection
        keepalive: true,
      });

      // RouterOSClient.connect() returns RosApiMenu which wraps RouterOSAPI
      const connectedMenu = (await Promise.race([
        this.streamApi.connect(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Stream connection timeout (30s)')), 30000),
        ),
      ])) as RosApiMenu;

      // Store both wrapper and underlying API
      this.streamMenu = connectedMenu;
      this.streamClient = extractRouterOsApi(connectedMenu);

      if (!this.streamClient) {
        throw new Error('Failed to get stream RouterOS API instance');
      }

      // Setup error handlers
      if (this.streamClient && this.streamClient.on) {
        this.streamClient.on('error', (error: Error) => {
          this.logger.error(`Stream RouterOS socket error: ${error.message} (errno: ${getRouterOsCode(error)})`);
          const code = getRouterOsCode(error);
          if (
            code === -4077 ||
            code === 'SOCKTMOUT' ||
            code === 'ECONNRESET' ||
            code === 'ETIMEDOUT' ||
            code === 'EPIPE'
          ) {
            this.isStreamConnected = false;
            this.logger.warn('Stream connection marked as disconnected due to socket error');
          }
        });

        this.streamClient.on('close', () => {
          this.logger.warn('Stream RouterOS connection closed');
          this.isStreamConnected = false;
        });

        this.streamClient.on('timeout', () => {
          this.logger.warn('Stream RouterOS connection timeout');
          this.isStreamConnected = false;
        });
      }

      this.isStreamConnected = true;
      this.logger.log('Stream client connected successfully');

      return true;
    } catch (error: unknown) {
      this.logger.error(`Failed to connect stream client: ${getErrorMessage(error)}`);
      this.isStreamConnected = false;
      this.streamApi = null;
      this.streamClient = null;
      return false;
    } finally {
      this.streamConnectionLock = false;
    }
  }

  async disconnect() {
    // Disconnect stream API
    if (this.streamApi && this.isStreamConnected) {
      try {
        await this.streamApi.close();
      } catch (e) {
        // Ignore close errors
      }
      this.streamApi = null;
      this.streamClient = null;
      this.streamMenu = null;
      this.isStreamConnected = false;
      this.logger.log('Stream client disconnected');
    }

    // Disconnect query API
    if (this.queryApi && this.isConnected) {
      try {
        await this.queryApi.close();
      } catch (e) {
        // Ignore close errors
      }
      this.queryApi = null;
      this.queryClient = null;
      this.queryMenu = null;
      this.isConnected = false;
      this.logger.log('Query client disconnected');
    }
  }

  getConnectionStatus(): boolean {
    const status = this.isConnected && this.queryClient !== null;
    this.logger.debug(
      `Mikrotik connection status: ${status} (isConnected: ${this.isConnected}, queryClient: ${this.queryClient ? 'exists' : 'null'})`,
    );
    return status;
  }

  isStreamClientConnected(): boolean {
    return this.isStreamConnected && this.streamClient !== null;
  }

  async checkConnection(): Promise<boolean> {
    if (!this.isConnected || !this.queryClient) {
      this.logger.log('Mikrotik not connected, attempting to connect...');
      return await this.connect();
    }
    return true;
  }

  /** Tandai koneksi query tidak valid (dipakai saat error socket di operasi bisnis) */
  invalidate() {
    this.isConnected = false;
    this.queryClient = null;
  }

  /** Tandai koneksi stream tidak valid */
  invalidateStream() {
    this.isStreamConnected = false;
    this.streamClient = null;
  }

  getHealth(): {
    queryClient: { connected: boolean; lastActivity: Date };
    streamClient: { connected: boolean };
  } {
    return {
      queryClient: {
        connected: this.isConnected,
        lastActivity: new Date(this.lastActivity),
      },
      streamClient: {
        connected: this.isStreamConnected,
      },
    };
  }

  // ==========================================
  // OPERATION EXECUTION (serialized + timed)
  // ==========================================

  /**
   * Eksekusi perintah dengan serialisasi, auto-reconnect, timeout protection,
   * dan error mapping yang aman (router offline tidak melempar).
   */
  async execute<T>(
    command: string,
    params: string[] = [],
    defaultValue: T,
    timeoutMs: number = 30000,
  ): Promise<T> {
    await this.semaphore.acquire();
    this.pendingOperations++;

    try {
      // Auto-reconnect jika disconnected
      if (!this.queryClient || !this.isConnected) {
        this.logger.warn(`Client not connected for command: ${command}, attempting reconnect...`);
        const reconnected = await this.connect();
        if (!reconnected) {
          this.logger.error(`Failed to reconnect for command: ${command}`);
          return defaultValue;
        }
      }

      // Build raw command array
      const commandArray = this.buildRawCommand(command, params);

      // Timeout wrapper
      const result = await Promise.race([
        this.executeRawCommand(commandArray),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('TIMEOUT')), timeoutMs),
        ),
      ]);

      // Update last activity on success
      this.lastActivity = Date.now();
      return result as T;
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      const code = getRouterOsCode(error);
      if (message === 'TIMEOUT' || message.includes('timeout')) {
        this.logger.warn(`Timeout executing command ${command} (${timeoutMs}ms)`);
        return defaultValue;
      }

      if (
        code === 'UNKNOWNREPLY' ||
        message.includes('!empty') ||
        message.includes('no such item')
      ) {
        this.logger.debug(`Empty result for ${command} - returning default`);
        return defaultValue;
      }

      if (
        code === -4077 ||
        code === 'ECONNRESET' ||
        code === 'ECONNREFUSED' ||
        code === 'ETIMEDOUT' ||
        message.includes('closed') ||
        message.includes('ECONNRESET') ||
        message.includes('ECONNREFUSED') ||
        message.includes('ETIMEDOUT') ||
        message.includes('socket')
      ) {
        this.logger.warn(`Connection issue on ${command}: ${message} (errno: ${code})`);
        this.isConnected = false;
        return defaultValue;
      }

      this.logger.error(`Error executing ${command}: ${message}`);
      throw error;
    } finally {
      this.pendingOperations--;
      this.semaphore.release();
    }
  }

  /** Serialisasi operasi arbitrer (mis. create/update profil) */
  async queueOperation<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.operationQueue.then(async () => {
      return await operation();
    });

    this.operationQueue = result.catch(() => {});

    return result;
  }

  async ensureConnected(): Promise<void> {
    // Fresh connection — tidak perlu cek
    const connectionAge = Date.now() - this.lastActivity;
    if (this.isConnected && this.queryClient && connectionAge < 30000) {
      return;
    }

    // Stale connection — uji dengan ping
    if (connectionAge > 60000 && this.isConnected) {
      this.logger.debug('Connection might be stale, testing...');
      try {
        await Promise.race([
          this.queryClient!.write('/system/identity/print'),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Test timeout')), 3000)),
        ]);
        this.lastActivity = Date.now();
        return; // Connection masih sehat
      } catch (error) {
        this.logger.warn('Stale connection detected, will reconnect...');
        this.isConnected = false;
      }
    }

    if (!this.isConnected || !this.queryClient) {
      if (this.lastActivity > 0) {
        this.logger.log('Reconnecting to Mikrotik router...');
      }
      this.connectionRetries = 0;
      const connected = await this.connect();
      if (!connected) {
        this.logger.warn('Mikrotik router is unreachable. Proceeding with offline-safe fallback.');
        throw new Error('Mikrotik router is unreachable');
      }
    }

    this.lastActivity = Date.now();
  }

  // ==========================================
  // INTERNAL HELPERS
  // ==========================================

  private buildRawCommand(command: string, params: string[]): string[] {
    const cmdPath = command.startsWith('/') ? command : `/${command}`;
    const commandArray: string[] = [cmdPath];
    for (const param of params) {
      commandArray.push(param);
    }
    return commandArray;
  }

  private async executeRawCommand(commandArray: string[]): Promise<unknown> {
    if (!this.queryClient) {
      throw new Error('RouterOS client not connected');
    }

    const commandStr = commandArray.join(' ');
    this.logger.debug(`RAW command dispatch: ${commandStr}`);
    const startTime = Date.now();

    try {
      const result = await this.queryClient.write(commandArray);
      const duration = Date.now() - startTime;

      if (Array.isArray(result)) {
        this.logger.debug(`RAW response (${duration}ms): ${result.length} items`);
      } else {
        this.logger.debug(`RAW response (${duration}ms): ${JSON.stringify(result).substring(0, 100)}`);
      }

      return result || [];
    } catch (error: unknown) {
      const duration = Date.now() - startTime;
      if (getRouterOsCode(error) === 'UNKNOWNREPLY') {
        this.logger.debug(`RAW empty response (${duration}ms) on ${commandStr}: No items found`);
        return [];
      }

      this.logger.error(`RAW error response (${duration}ms) on ${commandStr}: ${getErrorMessage(error)}`);
      return [];
    }
  }

  /**
   * Patch socket agar menangani respons !empty (yang dilempar node-routeros
   * sebagai UNKNOWNREPLY yang tidak bisa di-catch dan bisa mematikan proses).
   */
  private patchChannelForEmptyResponses() {
    if (!this.queryClient) return;

    try {
      const connector = (this.queryClient as unknown as RouterOsClientInternals).connector;
      if (!connector || !connector.socket || !connector.receiver) {
        this.logger.warn('Could not access connector internals for socket patching');
        return;
      }

      const socket = connector.socket;
      const receiver = connector.receiver;

      const originalListeners = socket.listeners('data');
      if (originalListeners.length === 0) {
        this.logger.warn('No socket data listeners found for patching');
        return;
      }

      const originalHandler = originalListeners[0];

      socket.removeAllListeners('data');

      socket.on('data', (data: Buffer) => {
        const emptyMarker = Buffer.from('!empty');
        const idx = data.indexOf(emptyMarker);

        if (idx !== -1) {
          this.logger.debug('Intercepted !empty in socket data stream');

          const sentenceStart = idx - 1; // length byte

          let sentenceEnd = idx;
          while (sentenceEnd < data.length) {
            if (data[sentenceEnd] === 0x00) {
              sentenceEnd += 1;
              break;
            }
            sentenceEnd++;
          }

          const before = data.slice(0, sentenceStart);
          const after = data.slice(sentenceEnd);
          data = Buffer.concat([before, after]);

          this.logger.debug(`Removed !empty sentence, ${sentenceEnd - sentenceStart} bytes stripped`);
        }

        originalHandler.call(receiver, data);
      });

      this.logger.debug('Socket stream patched for empty response handling');
    } catch (error) {
      this.logger.warn('Failed to patch socket for empty response handling:', error);
    }
  }

  private startKeepAlive() {
    this.stopKeepAlive();
    this.keepAliveInterval = setInterval(async () => {
      if (this.isConnected && this.queryClient) {
        try {
          const result = await this.execute<MikrotikRecord[]>(
            '/system/identity/print',
            [],
            [],
            10000,
          );
          this.lastActivity = Date.now();
          this.logger.debug(
            result && result.length > 0
              ? 'Mikrotik keep-alive OK'
              : 'Mikrotik keep-alive (empty response, but OK)',
          );
        } catch (error: unknown) {
          if (
            getRouterOsCode(error) !== 'UNKNOWNREPLY' &&
            !getErrorMessage(error).includes('!empty')
          ) {
            this.logger.warn('Keep-alive ping failed. Reconnection will occur on next operation.');
            this.isConnected = false;
          }
        }
      }
    }, 300000); // 5 menit — cukup untuk deteksi koneksi terputus tanpa membebani CPU router
    this.logger.log('Mikrotik keep-alive heartbeat started (5 min interval)');
  }

  private stopKeepAlive() {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
  }

  private async getConnectionConfig(): Promise<{
    host: string;
    port: number;
    username: string;
    password: string;
  }> {
    const host =
      (await this.getSetting('mikrotik_host')) ||
      this.configService.get('MIKROTIK_HOST') ||
      '192.168.10.1';

    const portStr =
      (await this.getSetting('mikrotik_port')) ||
      this.configService.get('MIKROTIK_PORT') ||
      '8728';
    const port = parseInt(portStr, 10);

    const username =
      (await this.getSetting('mikrotik_username')) ||
      this.configService.get('MIKROTIK_USERNAME') ||
      'admin';

    const password =
      (await this.getSetting('mikrotik_password')) ||
      this.configService.get('MIKROTIK_PASSWORD') ||
      '';

    return { host, port, username, password };
  }

  private async getSetting(key: string): Promise<string | null> {
    try {
      const setting = await this.prisma.setting.findUnique({
        where: { key },
      });

      if (!setting) return null;

      // Decrypt jika encrypted (field password)
      if (setting.isEncrypted && setting.value) {
        return this.decrypt(setting.value);
      }

      return setting.value || null;
    } catch (error: unknown) {
      this.logger.error(`Failed to get setting ${key}: ${getErrorMessage(error)}`);
      return null;
    }
  }

  private decrypt(text: string): string {
    // Fail-fast: tanpa fallback hardcoded
    const secret = requireEnv('ENCRYPTION_KEY');
    try {
      if (!text || !text.includes(':')) {
        return text;
      }
      const parts = text.split(':');
      if (parts.length < 2 || parts[0].length !== 32) {
        return text;
      }

      const key = crypto.createHash('sha256').update(secret).digest();

      const iv = Buffer.from(parts.shift()!, 'hex');
      if (iv.length !== 16) {
        return text;
      }
      const encryptedText = parts.join(':');
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
      let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error: unknown) {
      this.logger.warn(`Failed to decrypt value: ${getErrorMessage(error)}`);
      return text;
    }
  }
}
