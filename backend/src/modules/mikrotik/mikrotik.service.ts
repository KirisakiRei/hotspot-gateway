import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RouterOSClient } from 'routeros-client';
import { RStream } from 'node-routeros';
import { PrismaService } from '@/common/prisma.service';
import { MikrotikConnectionManager } from './mikrotik-connection.manager';
import { getErrorMessage } from '@/common/utils/error';
import {
  getRouterOsCode,
  type ActiveStreamInfo,
  type HotspotProfileRecord,
  type HotspotSessionRecord,
  type HotspotUserRecord,
  type MikrotikRecord,
  type StreamListenPayload,
  type SystemResourcesRecord,
} from './mikrotik.types';

import { EventEmitter } from 'events';

@Injectable()
export class MikrotikService {
  private readonly logger = new Logger(MikrotikService.name);

  // ==========================================
  // STATE KONEKSI DITANGANI OLEH MikrotikConnectionManager
  // ==========================================

  // ==========================================
  // STREAM MANAGEMENT
  // ==========================================
  private readonly streamEmitter = new EventEmitter();
  private activeStreams: Map<string, ActiveStreamInfo> = new Map();
  private streamDataBuffer: Map<string, MikrotikRecord[]> = new Map();

  // PERFORMANCE: Cache for profiles (valid for 10 minutes)
  private profileCache: Map<string, { valid: boolean; timestamp: number }> = new Map();
  private readonly PROFILE_CACHE_TTL = 10 * 60 * 1000; // 10 minutes
  private validProfiles: string[] = []; // List of known valid profiles
  private lastProfileFetch = 0;

  // PERFORMANCE: Cache for active sessions (valid for 8 seconds)
  private activeSessionsCache: HotspotSessionRecord[] = [];
  private activeSessionsCacheTime = 0;
  private readonly ACTIVE_SESSIONS_CACHE_TTL = 8000; // 8 seconds

  // PERFORMANCE: Cache for system resources (valid for 15 seconds)
  private systemResourcesCache: SystemResourcesRecord | null = null;
  private systemResourcesCacheTime = 0;
  private readonly SYSTEM_RESOURCES_CACHE_TTL = 15000; // 15 seconds

  // PERFORMANCE: Cache for hotspot stats (valid for 10 seconds)
  private hotspotStatsCache: Record<string, unknown> | null = null;
  private hotspotStatsCacheTime = 0;
  private readonly HOTSPOT_STATS_CACHE_TTL = 10000; // 10 seconds

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private conn: MikrotikConnectionManager,
  ) {}

  /**
   * Safe wrapper for Mikrotik API calls
   * Delegated ke MikrotikConnectionManager (semaphore + reconnect + timeout)
   */
  private safeMikrotikWrite<T>(
    command: string,
    params: string[] = [],
    defaultValue?: T,
    timeoutMs: number = 30000
  ): Promise<T> {
    const fallback = (defaultValue ?? []) as T;
    return this.conn.execute(command, params, fallback, timeoutMs);
  }

  // Auto-connect on module initialization — didelegasikan ke MikrotikConnectionManager
  async onModuleInit() {
    return this.conn.onModuleInit();
  }

  // Cleanup on module destroy
  async onModuleDestroy() {
    await this.cancelAllStreams();
    return this.conn.onModuleDestroy();
  }

  async connect(): Promise<boolean> {
    return this.conn.connect();
  }

  async disconnect() {
    await this.cancelAllStreams();
    return this.conn.disconnect();
  }

  getConnectionStatus(): boolean {
    return this.conn.getConnectionStatus();
  }

  async checkConnection(): Promise<boolean> {
    return this.conn.checkConnection();
  }

  async testConnection(
    host: string,
    port: number,
    username: string,
    password: string,
  ): Promise<MikrotikRecord> {
    const testApi = new RouterOSClient({
      host,
      user: username,
      password,
      port,
      timeout: 10,
    });

    const testClient = await testApi.connect();
    const result = await testClient.menu('/system/identity').getOnly();
    await testApi.close();

    return (result ?? {}) as MikrotikRecord;
  }

  // ==========================================
  // HOTSPOT USER MANAGEMENT
  // ==========================================

  /**
   * Get default/first available hotspot profile from Mikrotik
   */
  async getDefaultHotspotProfile(): Promise<string> {
    try {
      // Use cached profiles if fresh
      if (this.validProfiles.length > 0 && (Date.now() - this.lastProfileFetch) < this.PROFILE_CACHE_TTL) {
        return this.validProfiles[0] || 'default';
      }
      
      await this.ensureConnected();
      const profiles = await this.safeMikrotikWrite<any[]>(
        '/ip/hotspot/user/profile/print',
        [],
        []
      );
      
      if (profiles.length > 0) {
        // Cache all profiles
        this.validProfiles = profiles.map(p => p.name).filter(Boolean);
        this.lastProfileFetch = Date.now();
        this.logger.debug(` Cached ${this.validProfiles.length} profiles`);
        
        // Return first profile name (usually 'default')
        return profiles[0].name || 'default';
      }
      return 'default';
    } catch (error) {
      this.logger.warn(`Failed to get default profile, using 'default': ${getErrorMessage(error)}`);
      return 'default';
    }
  }

  /**
   * Validate if a profile exists in Mikrotik
   * OPTIMIZED: Uses cache + assumes valid if cache exists or timeout occurs
   * The key insight: if we created the profile via our system, it exists
   */
  async validateProfile(profileName: string): Promise<boolean> {
    // Always trust these common profiles
    if (['default', 'publicwifi', 'premium', 'vip'].includes(profileName.toLowerCase())) {
      return true;
    }
    
    // Check cache first
    const cached = this.profileCache.get(profileName);
    if (cached && (Date.now() - cached.timestamp) < this.PROFILE_CACHE_TTL) {
      this.logger.debug(`Profile ${profileName} found in cache: ${cached.valid}`);
      return cached.valid;
    }
    
    // Check validProfiles array (faster than Mikrotik query)
    if (this.validProfiles.length > 0 && (Date.now() - this.lastProfileFetch) < this.PROFILE_CACHE_TTL) {
      const isValid = this.validProfiles.includes(profileName);
      this.profileCache.set(profileName, { valid: isValid, timestamp: Date.now() });
      this.logger.debug(`Profile ${profileName} from valid list: ${isValid}`);
      return isValid;
    }
    
    // If we get here, try to fetch but ASSUME VALID on timeout
    // This prevents timeout being misinterpreted as "profile doesn't exist"
    try {
      await this.ensureConnected();
      const profiles = await this.safeMikrotikWrite<any[] | null>(
        '/ip/hotspot/user/profile/print',
        [`?name=${profileName}`],
        null, // Use null as default to detect timeout
        5000  // 5s timeout
      );
      
      // If null (timeout), assume profile exists - better to try than fail
      if (profiles === null) {
        this.logger.warn(`Profile validation timeout for ${profileName} - assuming valid`);
        return true;
      }
      
      const isValid = profiles.length > 0;
      this.profileCache.set(profileName, { valid: isValid, timestamp: Date.now() });
      return isValid;
    } catch (error) {
      this.logger.warn(`Failed to validate profile ${profileName}, assuming valid: ${getErrorMessage(error)}`);
      return true; // Assume valid on error - let Mikrotik reject if wrong
    }
  }

  async addHotspotUser(data: {
    username: string;
    password: string;
    profile: string;
    macAddress?: string;
    comment?: string;
  }) {
    await this.ensureConnected();

    try {
      // Validate profile exists, fallback to default if not
      let profileToUse = data.profile;
      const profileValid = await this.validateProfile(profileToUse);
      
      if (!profileValid) {
        this.logger.warn(`Profile '${profileToUse}' not found in Mikrotik, getting default profile`);
        profileToUse = await this.getDefaultHotspotProfile();
        this.logger.log(`Using profile: ${profileToUse}`);
      }

      const result = await this.safeMikrotikWrite('/ip/hotspot/user/add', [
        `=name=${data.username}`,
        `=password=${data.password}`,
        `=profile=${profileToUse}`,
        ...(data.macAddress ? [`=mac-address=${data.macAddress}`] : []),
        ...(data.comment ? [`=comment=${data.comment}`] : []),
      ]);

      this.logger.log(`Added hotspot user: ${data.username} with profile: ${profileToUse}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to add hotspot user: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  async removeHotspotUser(username: string) {
    return this.queueOperation(async () => {
      await this.ensureConnected();

      try {
        // Find user first
        const users = await this.safeMikrotikWrite<any[]>('/ip/hotspot/user/print', [
          `?name=${username}`,
        ], []);

        if (users.length > 0) {
          const userId = users[0]['.id'];
          await this.safeMikrotikWrite('/ip/hotspot/user/remove', [`=.id=${userId}`]);
          this.logger.log(`Removed hotspot user: ${username}`);
        } else {
          this.logger.debug(`User ${username} not found in Mikrotik (already removed?)`);
        }
      } catch (error) {
        this.logger.warn(`Failed to remove hotspot user ${username}: ${getErrorMessage(error)}`);
        // Don't throw - this is a best-effort operation
      }
    });
  }

  /**
   * OPTIMIZED: Batch delete multiple hotspot users in parallel
   * Much faster than deleting one by one
   */
  async removeHotspotUsersBatch(usernames: string[]): Promise<{ success: number; failed: number }> {
    if (!usernames || usernames.length === 0) {
      return { success: 0, failed: 0 };
    }
    
    await this.ensureConnected();
    this.logger.log(` Batch deleting ${usernames.length} users from Mikrotik...`);
    
    let success = 0;
    let failed = 0;

    try {
      // Get all users in ONE query instead of per-user
      const allUsers = await this.safeMikrotikWrite<any[]>(
        '/ip/hotspot/user/print',
        [],
        [],
        15000 // 15s for large lists
      );

      // Build a map for quick lookup
      const userMap = new Map<string, string>();
      for (const user of allUsers) {
        if (user.name) {
          userMap.set(user.name, user['.id']);
        }
      }

      // Batch delete in chunks of 10 (parallel within chunk)
      const CHUNK_SIZE = 10;
      for (let i = 0; i < usernames.length; i += CHUNK_SIZE) {
        const chunk = usernames.slice(i, i + CHUNK_SIZE);
        
        await Promise.all(chunk.map(async (username) => {
          const userId = userMap.get(username);
          if (userId) {
            try {
              await this.safeMikrotikWrite('/ip/hotspot/user/remove', [`=.id=${userId}`], undefined, 3000);
              success++;
            } catch (e) {
              this.logger.debug(`Failed to delete user ${username}: ${e.message}`);
              failed++;
            }
          } else {
            // User already doesn't exist - count as success
            success++;
          }
        }));
      }

      this.logger.log(` Batch delete complete: ${success} success, ${failed} failed`);
    } catch (error) {
      this.logger.error(`Batch delete error: ${getErrorMessage(error)}`);
      failed = usernames.length - success;
    }

    return { success, failed };
  }

  async getHotspotUsers() {
    await this.ensureConnected();

    try {
      const users = await this.safeMikrotikWrite<any[]>(
        '/ip/hotspot/user/print',
        [],
        []
      );
      return Array.isArray(users) ? users : [];
    } catch (error: unknown) {
      this.logger.error(`Failed to get hotspot users: ${getErrorMessage(error)}`);
      return [];
    }
  }

  // ==========================================
  // ACTIVE SESSIONS
  // ==========================================

  /**
   * Get active sessions with caching (8 seconds TTL)
   * This dramatically reduces Mikrotik queries for user page and monitoring
   */
  async getActiveSessions() {
    // Check cache first
    const now = Date.now();
    if (this.activeSessionsCache.length > 0 && (now - this.activeSessionsCacheTime) < this.ACTIVE_SESSIONS_CACHE_TTL) {
      this.logger.debug(` Active sessions from cache (${this.activeSessionsCache.length} sessions)`);
      return this.activeSessionsCache;
    }

    await this.ensureConnected();

    try {
      const sessions = await this.safeMikrotikWrite<any[]>(
        '/ip/hotspot/active/print',
        [],
        []
      );
      
      const result = Array.isArray(sessions) ? sessions : [];
      
      // Update cache
      this.activeSessionsCache = result;
      this.activeSessionsCacheTime = now;
      this.logger.debug(` Active sessions fetched from Mikrotik: ${result.length} sessions (cached for 8s)`);
      
      return result;
    } catch (error: unknown) {
      this.logger.error(`Failed to get active sessions: ${getErrorMessage(error)}`);
      return this.activeSessionsCache.length > 0 ? this.activeSessionsCache : [];
    }
  }

  /**
   * Invalidate active sessions cache - call after disconnect/kick operations
   */
  invalidateActiveSessionsCache() {
    this.activeSessionsCache = [];
    this.activeSessionsCacheTime = 0;
    this.logger.debug(' Active sessions cache invalidated');
  }

  async disconnectUser(username: string) {
    await this.ensureConnected();

    try {
      const sessions = await this.safeMikrotikWrite<any[]>('/ip/hotspot/active/print', [
        `?user=${username}`,
      ], []);

      if (sessions.length > 0) {
        const sessionId = sessions[0]['.id'];
        await this.safeMikrotikWrite('/ip/hotspot/active/remove', [
          `=.id=${sessionId}`,
        ]);
        this.logger.log(`Disconnected user: ${username}`);
        
        // Invalidate cache after disconnect
        this.invalidateActiveSessionsCache();
      }
    } catch (error) {
      this.logger.error(`Failed to disconnect user: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  // ==========================================
  // HOTSPOT PROFILES
  // ==========================================

  async getHotspotProfiles() {
    await this.ensureConnected();

    try {
      const profiles = await this.safeMikrotikWrite<any[]>(
        '/ip/hotspot/user/profile/print',
        [],
        []
      );
      return Array.isArray(profiles) ? profiles : [];
    } catch (error: unknown) {
      this.logger.error(`Failed to get hotspot user profiles: ${getErrorMessage(error)}`);
      return [];
    }
  }

  // ==========================================
  // AUTHENTICATION
  // ==========================================

  /**
   * Create or update hotspot user with specific profile
   * OPTIMIZED: Use "try add, fallback to update" pattern to minimize queries
   * TRUST common profile names on timeout - don't fallback to 'default' unnecessarily
   */
  async createOrUpdateHotspotUser(
    username: string,
    password: string,
    profileName: string = 'default',
  ): Promise<boolean> {
    try {
      this.logger.log(` START: createOrUpdateHotspotUser(username="${username}", profile="${profileName}")`);
      
      await this.ensureConnected();
      this.logger.debug(` Connection verified`);

      // Use the profile as-is - don't validate on every call
      // Common profiles like 'default', 'publicwifi', 'premium' should be trusted
      // If profile doesn't exist, Mikrotik will error and we'll handle it
      let finalProfile = profileName || 'default';
      
      this.logger.log(` Creating/updating hotspot user: ${username} with profile: ${finalProfile}`);

      // Strategy: Try to ADD first, if user exists -> UPDATE
      // This is faster than check-then-create pattern
      
      try {
        // Attempt to create new user directly
        this.logger.debug(` Attempting to add new user...`);
        await this.safeMikrotikWrite('/ip/hotspot/user/add', [
          `=name=${username}`,
          `=password=${password}`,
          `=profile=${finalProfile}`,
          `=comment=Voucher-${new Date().toISOString().split('T')[0]}`,
        ]);
        this.logger.log(` SUCCESS: Created hotspot user: ${username}`);
        return true;
      } catch (addError: unknown) {
        const addMessage = getErrorMessage(addError);
        if (addMessage.includes('already') || addMessage.includes('exists')) {
          this.logger.debug(` User ${username} exists, updating...`);
          
          // Get user ID and update
          const users = await this.safeMikrotikWrite<any[]>('/ip/hotspot/user/print', [
            `?name=${username}`,
          ], []);
          
          if (users && users.length > 0) {
            await this.safeMikrotikWrite('/ip/hotspot/user/set', [
              `=.id=${users[0]['.id']}`,
              `=password=${password}`,
              `=profile=${finalProfile}`,
            ]);
            this.logger.log(` SUCCESS: Updated hotspot user: ${username}`);
            return true;
          }
        }
        
        // If it's a different error, log and try alternative approach
        this.logger.warn(`Add failed: ${addMessage}, trying alternative...`);
        
        // Alternative: Remove and re-add
        try {
          await this.safeMikrotikWrite('/ip/hotspot/user/remove', [
            `=numbers=${username}`,
          ]);
        } catch (e) {
          // Ignore remove errors
        }
        
        // Try add again
        await this.safeMikrotikWrite('/ip/hotspot/user/add', [
          `=name=${username}`,
          `=password=${password}`,
          `=profile=${finalProfile}`,
          `=comment=Voucher-${new Date().toISOString().split('T')[0]}`,
        ]);
        this.logger.log(` SUCCESS: Re-created hotspot user: ${username}`);
        return true;
      }
    } catch (error: unknown) {
      this.logger.error(`FAILED: createOrUpdateHotspotUser - Error: ${getErrorMessage(error)}. Context: username="${username}", profile="${profileName}"`);
      return false;
    }
  }
  /**
   * Authenticate user and create hotspot session
   * OPTIMIZED: User is already created in Mikrotik - return login URL for browser redirect
   * The CORRECT flow: user's browser must visit Mikrotik login URL, not backend HTTP POST
   */
  async authenticateUser(
    username: string,
    password: string,
    mac: string,
    ip: string,
  ): Promise<{ success: boolean; loginUrl?: string; message?: string }> {
    try {
      this.logger.log(` authenticateUser(user="${username}", mac="${mac}")`);
      
      await this.ensureConnected();

      // Check if user already has active session
      const existingSession = await this.getActiveSessionByMac(mac);
      if (existingSession) {
        this.logger.log(` MAC ${mac} already has active session`);
        return { success: true, message: 'Already connected' };
      }

      // Upaya 1 (utama): aktifkan session langsung via API.
      // User sudah dibuat di router (createOrUpdateHotspotUser), sehingga
      // /ip/hotspot/active/add cukup untuk menandai MAC aktif — device
      // langsung online TANPA redirect ke halaman login, dan password
      // TIDAK pernah muncul di query string (bocor ke history/log/referer).
      try {
        const added = await this.safeMikrotikWrite<HotspotSessionRecord[] | null>(
          '/ip/hotspot/active/add',
          [
            `=user=${username}`,
            `=mac-address=${mac}`,
            `=address=${ip}`,
          ],
          null,
          10000,
        );

        if (added !== null) {
          this.logger.log('Session activated directly via active/add');
          return { success: true, message: 'Session activated' };
        }
        this.logger.warn('active/add returned empty - falling back to login URL');
      } catch (addError: unknown) {
        this.logger.warn(`active/add failed (${getErrorMessage(addError)}) - falling back to login URL`);
      }

      // Build Mikrotik hotspot link-login URL for browser redirect
      // This is the CORRECT way - user's browser visits this URL to login
      const gatewayIp = ip.split('.').slice(0, 3).join('.') + '.1';
      const loginUrl = `http://${gatewayIp}/login?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
      
      this.logger.log(` Generated login URL for user ${username}: ${loginUrl.replace(password, '***')}`);
      this.logger.log(` User ${username} ready for browser redirect login`);
      
      return { 
        success: true, 
        loginUrl,
        message: 'User ready, redirect to login URL' 
      };
      
    } catch (error: unknown) {
      this.logger.error(`FAILED: authenticateUser - ${getErrorMessage(error)}`);
      return { success: false, message: getErrorMessage(error) };
    }
  }

  // ==========================================
  // HELPER METHODS
  // ==========================================

  private async ensureConnected(): Promise<void> {
    return this.conn.ensureConnected();
  }

  /**
   * Serialize operations to prevent concurrent Mikrotik calls
   */
  private async queueOperation<T>(operation: () => Promise<T>): Promise<T> {
    return this.conn.queueOperation(operation);
  }

  /**
   * Safe wrapper for Mikrotik operations with automatic reconnection
   */
  private async safeExecute<T>(operation: () => Promise<T>, fallback: T): Promise<T> {
    try {
      await this.conn.ensureConnected();
      return await operation();
    } catch (error: unknown) {
      // Handle timeout or connection errors
      if (getRouterOsCode(error) === 'SOCKTMOUT' || getErrorMessage(error).includes('Timed out')) {
        this.logger.warn('Mikrotik connection timed out, marking as disconnected');
        this.conn.invalidate();
      }
      this.logger.error(`Mikrotik operation failed: ${getErrorMessage(error)}`);
      return fallback;
    }
  }

  // ==========================================
  // PROFILE MANAGEMENT
  // ==========================================

  /**
   * Refresh profile cache - call after create/update/delete profile operations
   * This ensures validateProfile() returns correct results
   */
  async refreshProfileCache(): Promise<void> {
    this.logger.log(' Refreshing profile cache...');
    
    // Clear all profile caches
    this.profileCache.clear();
    this.validProfiles = [];
    this.lastProfileFetch = 0;
    
    try {
      await this.ensureConnected();
      
      // Fetch all profiles from Mikrotik
      const profiles = await this.safeMikrotikWrite<any[]>(
        '/ip/hotspot/user/profile/print',
        [],
        [],
        10000
      );
      
      if (Array.isArray(profiles) && profiles.length > 0) {
        // Update validProfiles array
        this.validProfiles = profiles.map(p => p.name).filter(Boolean);
        this.lastProfileFetch = Date.now();
        
        // Update profileCache map
        for (const profile of profiles) {
          if (profile.name) {
            this.profileCache.set(profile.name, { valid: true, timestamp: Date.now() });
          }
        }
        
        this.logger.log(` Profile cache refreshed: ${this.validProfiles.length} profiles cached`);
      } else {
        this.logger.warn('âš  No profiles found in Mikrotik');
      }
    } catch (error) {
      this.logger.error(`âŒ Failed to refresh profile cache: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Check if a profile exists in Mikrotik
   */
  async checkProfileExists(profileName: string): Promise<boolean> {
    await this.ensureConnected();

    try {
      const profiles = await this.safeMikrotikWrite<any[]>(
        '/ip/hotspot/user/profile/print',
        [`?name=${profileName}`],
        [],
        5000
      );
      return profiles && profiles.length > 0;
    } catch (error) {
      this.logger.error(`âŒ Failed to check profile exists: ${getErrorMessage(error)}`);
      return false;
    }
  }

  /**
   * Create a new hotspot user profile in Mikrotik
   * Wrapped with queueOperation to prevent race conditions
   */
  async createHotspotProfile(profileData: {
    name: string;
    sharedUsers: number;
    rateLimit?: string;
    sessionTimeout?: string;
    idleTimeout?: string;
    keepaliveTimeout?: string;
  }) {
    return this.queueOperation(async () => {
      await this.ensureConnected();

      try {
        const params = [`=name=${profileData.name}`, `=shared-users=${profileData.sharedUsers}`];

        if (profileData.rateLimit) {
          params.push(`=rate-limit=${profileData.rateLimit}`);
        }
        if (profileData.sessionTimeout) {
          params.push(`=session-timeout=${profileData.sessionTimeout}`);
        }
        if (profileData.idleTimeout) {
          params.push(`=idle-timeout=${profileData.idleTimeout}`);
        }
        if (profileData.keepaliveTimeout) {
          params.push(`=keepalive-timeout=${profileData.keepaliveTimeout}`);
        }

        await this.safeMikrotikWrite('/ip/hotspot/user/profile/add', params, null, 10000);
        this.logger.log(` Created hotspot user profile: ${profileData.name}`);
        return true;
      } catch (error) {
        this.logger.error(`âŒ Failed to create profile: ${getErrorMessage(error)}`);
        throw error;
      }
    });
  }

  /**
   * Update an existing hotspot user profile in Mikrotik
   * Wrapped with queueOperation to prevent race conditions
   */
  async updateHotspotProfile(
    profileName: string,
    profileData: {
      sharedUsers?: number;
      rateLimit?: string;
      sessionTimeout?: string;
      idleTimeout?: string;
      keepaliveTimeout?: string;
    },
  ) {
    return this.queueOperation(async () => {
      await this.ensureConnected();

      try {
        // Find the profile
        const profiles = await this.safeMikrotikWrite<any[]>(
          '/ip/hotspot/user/profile/print',
          [`?name=${profileName}`],
          [],
          10000  // Increased timeout for stability
        );

        if (profiles.length === 0) {
          throw new Error(`Profile ${profileName} not found in Mikrotik. Please try refreshing the profile list.`);
        }

        const profileId = profiles[0]['.id'];
        const params = [`=.id=${profileId}`];

        if (profileData.sharedUsers !== undefined) {
          params.push(`=shared-users=${profileData.sharedUsers}`);
        }
        if (profileData.rateLimit !== undefined) {
          params.push(`=rate-limit=${profileData.rateLimit}`);
        }
        if (profileData.sessionTimeout !== undefined) {
          params.push(`=session-timeout=${profileData.sessionTimeout}`);
        }
        if (profileData.idleTimeout !== undefined) {
          params.push(`=idle-timeout=${profileData.idleTimeout}`);
        }
        if (profileData.keepaliveTimeout !== undefined) {
          params.push(`=keepalive-timeout=${profileData.keepaliveTimeout}`);
        }

        await this.safeMikrotikWrite('/ip/hotspot/user/profile/set', params, null, 10000);
        this.logger.log(` Updated hotspot user profile: ${profileName}`);
      } catch (error) {
        this.logger.error(`âŒ Failed to update profile: ${getErrorMessage(error)}`);
        throw error;
      }
    });
  }

  async deleteHotspotProfile(profileName: string) {
    return this.queueOperation(async () => {
      await this.ensureConnected();

      try {
        const profiles = await this.safeMikrotikWrite<any[]>(
          '/ip/hotspot/user/profile/print',
          [`?name=${profileName}`],
          [],
          10000
        );

        if (profiles.length > 0) {
          const profileId = profiles[0]['.id'];
          await this.safeMikrotikWrite(
            '/ip/hotspot/user/profile/remove',
            [`=.id=${profileId}`],
            null,
            10000
          );
          this.logger.log(` Deleted hotspot user profile: ${profileName}`);
        } else {
          this.logger.warn(`âš  Profile ${profileName} not found in Mikrotik (already deleted?)`);
        }
      } catch (error) {
        this.logger.error(`âŒ Failed to delete profile: ${getErrorMessage(error)}`);
        throw error;
      }
    });
  }

  // ==========================================
  // SESSION MANAGEMENT
  // ==========================================

  async getActiveSessionByMac(mac: string) {
    await this.ensureConnected();

    try {
      const sessions = await this.safeMikrotikWrite<any[]>(
        '/ip/hotspot/active/print',
        [`?mac-address=${mac}`],
        [],
        10000
      );
      return Array.isArray(sessions) && sessions.length > 0 ? sessions[0] : null;
    } catch (error: unknown) {
      this.logger.debug(`No active session found for MAC: ${mac}`);
      return null;
    }
  }

  async disconnectUserByMac(mac: string) {
    await this.ensureConnected();

    try {
      const sessions = await this.safeMikrotikWrite<any[]>(
        '/ip/hotspot/active/print',
        [`?mac-address=${mac}`],
        [],
        10000
      );

      if (sessions.length > 0) {
        const sessionId = sessions[0]['.id'];
        await this.safeMikrotikWrite(
          '/ip/hotspot/active/remove',
          [`=.id=${sessionId}`],
          null,
          10000
        );
        this.logger.log(`Disconnected user with MAC: ${mac}`);
      }
    } catch (error) {
      this.logger.error(`Failed to disconnect user by MAC: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  // ==========================================
  // MONITORING METHODS
  // ==========================================

  async getSystemResources() {
    return this.safeExecute(async () => {
      const resources = await this.safeMikrotikWrite<any[]>(
        '/system/resource/print',
        [],
        [],
        5000
      );
      
      if (!resources || resources.length === 0) {
        return {
          cpuLoad: 0,
          freeMemory: 0,
          totalMemory: 0,
          freeHddSpace: 0,
          totalHddSpace: 0,
          uptime: '0s',
          version: 'Unknown',
          boardName: 'Unknown',
        };
      }

      const resource = resources[0];
      return {
        cpuLoad: parseInt(resource['cpu-load'] || '0'),
        freeMemory: parseInt(resource['free-memory'] || '0'),
        totalMemory: parseInt(resource['total-memory'] || '0'),
        freeHddSpace: parseInt(resource['free-hdd-space'] || '0'),
        totalHddSpace: parseInt(resource['total-hdd-space'] || '0'),
        uptime: resource.uptime || '0s',
        version: resource.version || 'Unknown',
        boardName: resource['board-name'] || 'Unknown',
      };
    }, {
      cpuLoad: 0,
      freeMemory: 0,
      totalMemory: 0,
      freeHddSpace: 0,
      totalHddSpace: 0,
      uptime: '0s',
      version: 'Unknown',
      boardName: 'Unknown',
    });
  }

  async getActiveSessionsStats() {
    return this.safeExecute(async () => {
      const sessions = await this.safeMikrotikWrite<any[]>(
        '/ip/hotspot/active/print',
        [],
        [],
        10000
      );
      
      if (!Array.isArray(sessions)) {
        return {
          totalSessions: 0,
          totalBytesIn: 0,
          totalBytesOut: 0,
          sessions: [],
        };
      }

      let totalBytesIn = 0;
      let totalBytesOut = 0;

      const sessionDetails = sessions.map((session) => {
        const bytesIn = parseInt(session['bytes-in'] || '0');
        const bytesOut = parseInt(session['bytes-out'] || '0');
        totalBytesIn += bytesIn;
        totalBytesOut += bytesOut;

        return {
          user: session.user || 'Unknown',
          address: session.address || 'Unknown',
          macAddress: session['mac-address'] || 'Unknown',
          uptime: session.uptime || '0s',
          bytesIn,
          bytesOut,
        };
      });

      return {
        totalSessions: sessions.length,
        totalBytesIn,
        totalBytesOut,
        sessions: sessionDetails,
      };
    }, {
      totalSessions: 0,
      totalBytesIn: 0,
      totalBytesOut: 0,
      sessions: [],
    });
  }

  async getInterfaceStats(interfaceName: string = 'ether1') {
    return this.safeExecute(async () => {
      const interfaces = await this.safeMikrotikWrite<any[]>(
        '/interface/print',
        [`?name=${interfaceName}`],
        [],
        5000
      );
      
      if (!interfaces || interfaces.length === 0) {
        return {
          name: interfaceName,
          rxBytes: 0,
          txBytes: 0,
          rxPackets: 0,
          txPackets: 0,
          rxErrors: 0,
          txErrors: 0,
          rxDrops: 0,
          txDrops: 0,
          running: false,
        };
      }

      const iface = interfaces[0];
      return {
        name: iface.name || interfaceName,
        rxBytes: parseInt(iface['rx-byte'] || '0'),
        txBytes: parseInt(iface['tx-byte'] || '0'),
        rxPackets: parseInt(iface['rx-packet'] || '0'),
        txPackets: parseInt(iface['tx-packet'] || '0'),
        rxErrors: parseInt(iface['rx-error'] || '0'),
        txErrors: parseInt(iface['tx-error'] || '0'),
        rxDrops: parseInt(iface['rx-drop'] || '0'),
        txDrops: parseInt(iface['tx-drop'] || '0'),
        running: iface.running === 'true',
      };
    }, {
      name: interfaceName,
      rxBytes: 0,
      txBytes: 0,
      rxPackets: 0,
      txPackets: 0,
      rxErrors: 0,
      txErrors: 0,
      rxDrops: 0,
      txDrops: 0,
      running: false,
    });
  }

  async getHotspotStats() {
    return this.safeExecute(async () => {
      const [users, profiles, activeSessions] = await Promise.all([
        this.safeMikrotikWrite<any[]>('/ip/hotspot/user/print', [], [], 10000).catch(() => []),
        this.safeMikrotikWrite<any[]>('/ip/hotspot/user/profile/print', [], [], 10000).catch(() => []),
        this.safeMikrotikWrite<any[]>('/ip/hotspot/active/print', [], [], 10000).catch(() => []),
      ]);

      return {
        totalUsers: Array.isArray(users) ? users.length : 0,
        totalProfiles: Array.isArray(profiles) ? profiles.length : 0,
        activeUsers: Array.isArray(activeSessions) ? activeSessions.length : 0,
      };
    }, {
      totalUsers: 0,
      totalProfiles: 0,
      activeUsers: 0,
    });
  }

  async getMonitoringDashboard() {
    return this.safeExecute(async () => {
      const [systemResources, sessionsStats, interfaceStats, hotspotStats] =
        await Promise.all([
          this.getSystemResources(),
          this.getActiveSessionsStats(),
          this.getInterfaceStats('ether1'),
          this.getHotspotStats(),
        ]);

      return {
        system: systemResources,
        sessions: sessionsStats,
        interface: interfaceStats,
        hotspot: hotspotStats,
        timestamp: new Date().toISOString(),
      };
    }, {
      system: {
        cpuLoad: 0,
        freeMemory: 0,
        totalMemory: 0,
        freeHddSpace: 0,
        totalHddSpace: 0,
        uptime: '0s',
        version: 'Unknown',
        boardName: 'Unknown',
      },
      sessions: {
        totalSessions: 0,
        totalBytesIn: 0,
        totalBytesOut: 0,
        sessions: [],
      },
      interface: {
        name: 'ether1',
        rxBytes: 0,
        txBytes: 0,
        rxPackets: 0,
        txPackets: 0,
        rxErrors: 0,
        txErrors: 0,
        rxDrops: 0,
        txDrops: 0,
        running: false,
      },
      hotspot: {
        totalUsers: 0,
        totalProfiles: 0,
        activeUsers: 0,
      },
      timestamp: new Date().toISOString(),
    });
  }

  // ==========================================
  // STREAMING / LISTEN METHODS
  // ==========================================

  /**
   * Connect the stream client (separate connection for streaming operations)
   * This is a persistent connection that stays open for real-time data
   */
  async connectStreamClient(): Promise<boolean> {
    return this.conn.connectStreamClient();
  }

  getStreamEmitter(): EventEmitter {
    return this.streamEmitter;
  }

  /**
   * Check if stream client is connected
   */
  isStreamClientConnected(): boolean {
    return this.conn.isStreamClientConnected();
  }

  // ==========================================
  // TRUE /LISTEN IMPLEMENTATION
  // Uses MikroTik's native streaming with .tag for multiplexing
  // Data is pushed by MikroTik when changes occur (no polling!)
  // ==========================================

  /**
   * Start a TRUE /listen stream using MikroTik's native streaming
   * 
   * How MikroTik /listen works:
   * 1. Client sends: /ip/hotspot/active/listen .tag=session_123
   * 2. MikroTik responds with !re (initial data)
   * 3. When data changes, MikroTik pushes new !re automatically
   * 4. To stop: send /cancel =tag=session_123
   * 
   * @param menuPath - MikroTik menu path (e.g., '/ip/hotspot/active')
   * @param whereClause - Optional where clause for filtering
   * @param tag - Unique tag for this stream
   * @param onData - Callback when data is received
   */
  async startListenStream(
    menuPath: string, 
    whereClause: Record<string, string | number | boolean> = {},
    tag: string,
    onData?: (data: MikrotikRecord) => void
  ): Promise<boolean> {
    try {
      // Ensure stream client is connected
      if (!this.conn.isStreamConnectedFlag || !this.conn.streamClientApi) {
        const connected = await this.connectStreamClient();
        if (!connected) {
          this.logger.error(`Cannot start listen stream - stream client not connected`);
          return false;
        }
      }

      // Check if stream already exists
      if (this.activeStreams.has(tag)) {
        this.logger.warn(`Stream with tag ${tag} already exists, cancelling old stream first`);
        await this.cancelStream(tag);
      }

      this.logger.log(` Starting LISTEN stream: ${menuPath} with tag: ${tag}`);

      // Track this stream - will add the stream object after creation
      const streamInfo: ActiveStreamInfo = {
        command: menuPath,
        startedAt: new Date(),
        dataCount: 0,
      };
      this.activeStreams.set(tag, streamInfo);
      this.streamDataBuffer.set(tag, []);

      // Ensure stream client is connected and menu wrapper is available
      if (!this.conn.streamMenuApi) {
        throw new Error('Stream menu not initialized. Call connectStreamClient() first.');
      }

      // Use routeros-client's streaming capability
      // The menu().stream('listen') method creates a persistent channel
      // that receives data when changes occur
      let menu = this.conn.streamMenuApi.menu(menuPath);
      
      // Apply where clause if provided
      if (Object.keys(whereClause).length > 0) {
        menu = menu.where(whereClause);
      }

      // Start the stream with 'listen' action
      // The callback receives (error, data, stream) on each event
      // Wrap in try-catch to prevent uncaught exceptions
      const stream: RStream = menu.stream('listen', (err: Error | null, data: MikrotikRecord) => {
        try {
          if (err) {
            // Handle RouterOS connection errors gracefully
            const errorCode = getRouterOsCode(err);
            const safeErrors = ['SOCKTMOUT', 'ECONNRESET', 'ETIMEDOUT', 'UNKNOWNREPLY'];
            
            if ((typeof errorCode === 'string' && safeErrors.includes(errorCode)) || err.message.includes('Timed out')) {
              this.logger.warn(`Stream ${tag} connection error (will auto-reconnect): ${err.message}`);
              this.conn.invalidateStream();
            } else {
              this.logger.error(`Stream ${tag} error: ${err.message}`);
            }
            
            this.streamEmitter.emit(`stream:error:${tag}`, { 
              tag, 
              error: err.message 
            });
            return;
          }

        if (!this.activeStreams.has(tag)) return;

        const info = this.activeStreams.get(tag);
        if (info) {
          info.dataCount++;
        }

        // Buffer recent data (keep last 100 records)
        const buffer = this.streamDataBuffer.get(tag) || [];
        buffer.push(data);
        if (buffer.length > 100) buffer.shift();
        this.streamDataBuffer.set(tag, buffer);

        // Determine event type from MikroTik response
        // MikroTik /listen sends: .dead=true for removed items
        const eventType = data['.dead'] ? 'removed' : (data['.id'] ? 'update' : 'new');

        // Emit to event listeners
        this.streamEmitter.emit(`stream:data:${tag}`, {
          tag,
          command: menuPath,
          data,
          type: eventType,
          timestamp: new Date().toISOString(),
        });

        // Call the callback if provided
        if (onData) {
          onData({ ...data, _eventType: eventType });
        }

        this.logger.debug(`Stream ${tag} [${eventType}]: ${JSON.stringify(data).substring(0, 200)}`);
        
        } catch (callbackError: unknown) {
          this.logger.error(`Stream ${tag} callback error: ${getErrorMessage(callbackError)}`);
          this.streamEmitter.emit(`stream:error:${tag}`, { 
            tag, 
            error: getErrorMessage(callbackError),
          });
        }
      });

      // Store the stream object for later cancellation
      streamInfo.stream = stream;

      this.logger.log(`LISTEN stream ${tag} started successfully`);
      return true;
    } catch (error: unknown) {
      this.logger.error(`Failed to start listen stream ${tag}: ${getErrorMessage(error)}`);
      this.activeStreams.delete(tag);
      return false;
    }
  }

  /**
   * Fallback: Start a polling-based stream for commands that don't support /listen
   * Uses smart interval that reduces frequency when data is stable
   */
  async startPollingStream(
    command: string, 
    params: string[], 
    tag: string,
    intervalMs: number = 5000,
    onData?: (data: MikrotikRecord[]) => void
  ): Promise<boolean> {
    try {
      // Check if stream already exists
      if (this.activeStreams.has(tag)) {
        this.logger.warn(`Stream with tag ${tag} already exists, cancelling old stream first`);
        await this.cancelStream(tag);
      }

      this.logger.log(` Starting POLLING stream: ${command} with tag: ${tag} (interval: ${intervalMs}ms)`);

      // Track this stream
      this.activeStreams.set(tag, {
        command,
        startedAt: new Date(),
        dataCount: 0,
      });
      this.streamDataBuffer.set(tag, []);

      let lastDataHash = '';
      let consecutiveUnchanged = 0;
      let currentInterval = intervalMs;

      // Adaptive polling function
      const poll = async () => {
        if (!this.activeStreams.has(tag)) {
          return; // Stream was cancelled
        }

        try {
          const data = await this.safeMikrotikWrite<MikrotikRecord[]>(command, params, [], 10000);
          
          if (data && data.length >= 0) {
            const streamInfo = this.activeStreams.get(tag);
            if (streamInfo) {
              streamInfo.dataCount++;
            }

            // Check if data actually changed (smart polling optimization)
            const dataHash = JSON.stringify(data);
            const hasChanged = dataHash !== lastDataHash;
            lastDataHash = dataHash;

            if (hasChanged) {
              consecutiveUnchanged = 0;
              // Reset to fast polling when data changes
              currentInterval = intervalMs;

              // Emit the data
              this.streamEmitter.emit(`stream:data:${tag}`, {
                tag,
                command,
                data,
                type: 'polling',
                timestamp: new Date().toISOString(),
              });

              // Call the callback if provided
              if (onData) {
                onData(data);
              }
            } else {
              consecutiveUnchanged++;
              // Slow down polling if data is stable (max 30s interval)
              if (consecutiveUnchanged > 5) {
                currentInterval = Math.min(currentInterval * 1.5, 30000);
              }
            }
          }
        } catch (error: unknown) {
          this.logger.error(`Polling stream ${tag} error: ${getErrorMessage(error)}`);
          this.streamEmitter.emit(`stream:error:${tag}`, { 
            tag, 
            error: getErrorMessage(error),
          });
        }

        // Schedule next poll with adaptive interval
        if (this.activeStreams.has(tag)) {
          const timeoutId = setTimeout(poll, currentInterval);
          const current = this.activeStreams.get(tag);
          if (current) current.timeoutId = timeoutId;
        }
      };

      // Start first poll
      poll();

      this.logger.log(`  Polling stream ${tag} started`);
      return true;
    } catch (error: unknown) {
      this.logger.error(`Failed to start polling stream ${tag}: ${getErrorMessage(error)}`);
      this.activeStreams.delete(tag);
      return false;
    }
  }

  /**
   * Smart stream starter - uses /listen where supported, falls back to polling
   * 
   * Commands that support /listen in MikroTik:
   * - /ip/hotspot/active (realtime user connect/disconnect)
   * - /interface (interface changes)
   * - /log (log entries)
   * - /ip/firewall/connection (connections)
   * - /queue/simple (queues)
   * - /ip/arp (ARP table changes)
   * - /ip/dhcp-server/lease (DHCP lease changes)
   * 
   * Commands that DON'T support /listen (require polling):
   * - /system/resource (CPU, memory)
   * - /interface stats (traffic counters)
   */
  async startStream(
    menuPath: string, 
    whereClause: Record<string, string | number | boolean> = {},
    tag: string,
    onData?: (data: MikrotikRecord) => void
  ): Promise<boolean> {
    // Determine if command supports /listen
    const listenSupportedPaths = [
      '/ip/hotspot/active',
      '/interface',
      '/log',
      '/ip/firewall/connection',
      '/queue/simple',
      '/ip/arp',
      '/ip/dhcp-server/lease',
    ];

    // Clean the path
    const cleanPath = menuPath.replace(/\/(print|listen)$/, '');
    const supportsListen = listenSupportedPaths.some(path => cleanPath.startsWith(path));

    if (supportsListen) {
      // Use /listen command for real-time streaming
      return this.startListenStream(cleanPath, whereClause, tag, onData);
    } else {
      // Fall back to adaptive polling
      return this.startPollingStream(menuPath, [], tag, 5000, (rows) => {
        onData?.(rows[0] ?? {});
      });
    }
  }

  /**
   * Cancel a specific stream by tag
   * Sends /cancel command to MikroTik for /listen streams
   */
  async cancelStream(tag: string): Promise<boolean> {
    try {
      const streamInfo = this.activeStreams.get(tag);
      if (!streamInfo) {
        this.logger.warn(`No stream found with tag: ${tag}`);
        return false;
      }

      // For /listen streams with RStream object
      if (streamInfo.stream) {
        try {
          // Stop the stream (this sends /cancel to MikroTik)
          streamInfo.stream.stop();
          this.logger.log(` Sent /cancel for listen stream ${tag}`);
        } catch (e: unknown) {
          this.logger.debug(`Stream stop error (may be already stopped): ${getErrorMessage(e)}`);
        }
      }

      // For polling streams with timeout
      if (streamInfo.timeoutId) {
        clearTimeout(streamInfo.timeoutId);
      }

      // Legacy: clear interval if exists
      if (streamInfo.interval) {
        clearInterval(streamInfo.interval);
      }

      // Remove from tracking
      this.activeStreams.delete(tag);
      this.streamDataBuffer.delete(tag);

      this.logger.log(` âŒ Stream ${tag} cancelled`);
      this.streamEmitter.emit(`stream:cancelled:${tag}`, { tag });
      
      return true;
    } catch (error: unknown) {
      this.logger.error(`Failed to cancel stream ${tag}: ${getErrorMessage(error)}`);
      return false;
    }
  }

  /**
   * Cancel all active streams
   */
  async cancelAllStreams(): Promise<void> {
    const tags = Array.from(this.activeStreams.keys());
    this.logger.log(` Cancelling all streams (${tags.length} active)`);
    
    for (const tag of tags) {
      await this.cancelStream(tag);
    }
  }

  /**
   * Get information about all active streams
   */
  getActiveStreams(): Array<{
    tag: string;
    command: string;
    startedAt: Date;
    dataCount: number;
    durationSeconds: number;
    type: 'listen' | 'polling';
  }> {
    const streams: Array<{
      tag: string;
      command: string;
      startedAt: Date;
      dataCount: number;
      durationSeconds: number;
      type: 'listen' | 'polling';
    }> = [];

    this.activeStreams.forEach((info, tag) => {
      streams.push({
        tag,
        command: info.command,
        startedAt: info.startedAt,
        dataCount: info.dataCount,
        durationSeconds: Math.floor((Date.now() - info.startedAt.getTime()) / 1000),
        type: info.stream ? 'listen' : 'polling', // stream = RStream for /listen
      });
    });

    return streams;
  }

  /**
   * Get overall connection health status
   */
  getConnectionHealth(): {
    queryClient: { connected: boolean; lastActivity: Date };
    streamClient: { connected: boolean; activeStreams: number; listenStreams: number; pollingStreams: number };
  } {
    const streams = this.getActiveStreams();
    const health = this.conn.getHealth();
    return {
      queryClient: health.queryClient,
      streamClient: {
        ...health.streamClient,
        activeStreams: streams.length,
        listenStreams: streams.filter(s => s.type === 'listen').length,
        pollingStreams: streams.filter(s => s.type === 'polling').length,
      },
    };
  }

  // ==========================================
  // STREAM SUBSCRIPTION HELPERS
  // ==========================================

  /**
   * Subscribe to active sessions stream (hotspot users)
   * Uses TRUE /listen - MikroTik pushes data on connect/disconnect events!
   */
  async subscribeToActiveSessions(clientId: string, onData?: (data: MikrotikRecord) => void): Promise<boolean> {
    const tag = `sessions_${clientId}`;
    this.logger.log(` Subscribing to active sessions with /listen (tag: ${tag})`);
    return this.startStream(
      '/ip/hotspot/active',
      {}, // no filter - get all sessions
      tag,
      onData
    );
  }

  /**
   * Subscribe to system resources stream (CPU, memory, etc.)
   * NOTE: /system/resource does NOT support /listen, uses smart polling
   */
  async subscribeToSystemResources(clientId: string, onData?: (data: MikrotikRecord[]) => void): Promise<boolean> {
    const tag = `resources_${clientId}`;
    this.logger.log(` Subscribing to system resources (polling mode - no /listen support)`);
    return this.startPollingStream(
      '/system/resource',
      [],
      tag,
      3000, // Poll every 3 seconds for resources
      onData
    );
  }

  /**
   * Subscribe to interface traffic stream
   * Traffic counters need polling, but interface state changes support /listen
   */
  async subscribeToInterfaceTraffic(
    clientId: string, 
    interfaceName: string = 'ether1',
    onData?: (data: MikrotikRecord[]) => void
  ): Promise<boolean> {
    const tag = `traffic_${clientId}_${interfaceName}`;
    this.logger.log(` Subscribing to interface traffic (polling mode for counters)`);
    return this.startPollingStream(
      '/interface',
      [`?name=${interfaceName}`],
      tag,
      2000, // Poll every 2 seconds for traffic
      onData
    );
  }

  /**
   * Subscribe to DHCP leases (supports /listen!)
   */
  async subscribeToDhcpLeases(clientId: string, onData?: (data: MikrotikRecord) => void): Promise<boolean> {
    const tag = `dhcp_${clientId}`;
    this.logger.log(` Subscribing to DHCP leases with /listen (tag: ${tag})`);
    return this.startStream(
      '/ip/dhcp-server/lease',
      {},
      tag,
      onData
    );
  }

  /**
   * Subscribe to system log (supports /listen!)
   */
  async subscribeToLog(clientId: string, topics?: string[], onData?: (data: MikrotikRecord) => void): Promise<boolean> {
    const tag = `log_${clientId}`;
    const whereClause: Record<string, string | number | boolean> =
      topics && topics.length > 0 ? { topics: topics.join('|') } : {};
    this.logger.log(` Subscribing to system log with /listen (tag: ${tag})`);
    return this.startStream(
      '/log',
      whereClause,
      tag,
      onData
    );
  }

  /**
   * Unsubscribe from all streams for a specific client
   */
  async unsubscribeClient(clientId: string): Promise<void> {
    const tags = Array.from(this.activeStreams.keys())
      .filter(tag => tag.includes(clientId));
    
    this.logger.log(` Unsubscribing client ${clientId} from ${tags.length} streams`);
    
    for (const tag of tags) {
      await this.cancelStream(tag);
    }
  }
}
