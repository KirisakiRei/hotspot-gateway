import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { MikrotikService } from './mikrotik.service';
import { RedisService } from '@/modules/redis/redis.service';
import { getErrorMessage } from '@/common/utils/error';
import { toJsonValue, type JwtPayload, type StreamListenPayload } from './mikrotik.types';

interface ClientInfo {
  userId: string;
  username: string;
  role: string;
  subscribedStreams: Set<string>;
  connectedAt: Date;
}

@WebSocketGateway({
  namespace: '/mikrotik',
  cors: {
    origin: '*',
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
export class MikrotikGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(MikrotikGateway.name);
  
  // Track connected clients
  private clients: Map<string, ClientInfo> = new Map();
  
  // Rate limiting: track requests per client
  private requestCounts: Map<string, { count: number; resetAt: number }> = new Map();
  private readonly MAX_REQUESTS_PER_MINUTE = 60;

  constructor(
    private mikrotikService: MikrotikService,
    private jwtService: JwtService,
    private redisService: RedisService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('WebSocket gateway initialized');
    
    // Subscribe to Redis channels for multi-instance support
    this.setupRedisSubscriptions();
    
    // Setup MikroTik stream event listeners
    this.setupStreamListeners();
  }

  private setupRedisSubscriptions() {
    // Subscribe to stream data channel
    this.redisService.subscribe('mikrotik:stream:data', (data) => {
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        this.broadcastStreamData(data as Record<string, unknown>);
      }
    });

    this.redisService.subscribe('mikrotik:stream:error', (data) => {
      this.server.emit('stream:error', data);
    });
  }

  private setupStreamListeners() {
    const emitter = this.mikrotikService.getStreamEmitter();

    // Listen for all stream data events
    emitter.on('stream:data', (data: StreamListenPayload) => {
      this.redisService.publish('mikrotik:stream:data', toJsonValue(data));
      
      // Broadcast to local clients
      this.broadcastStreamData(data);
    });

    emitter.on('stream:error', (data: StreamListenPayload) => {
      this.redisService.publish('mikrotik:stream:error', toJsonValue(data));
    });
  }

  private broadcastStreamData(data: StreamListenPayload | Record<string, unknown>) {
    const tag = typeof data.tag === 'string' ? data.tag : '';
    if (!tag) return;
    const { tag: _tag, ...streamData } = data;
    
    this.clients.forEach((clientInfo, socketId) => {
      if (clientInfo.subscribedStreams.has(tag)) {
        this.server.to(socketId).emit('stream:data', streamData);
      }
    });
  }

  async handleConnection(client: Socket) {
    try {
      // Get token from query or auth header
      const token = client.handshake.query.token as string || 
                    client.handshake.auth?.token;

      if (!token) {
        this.logger.warn(`Client ${client.id} rejected - no token provided`);
        client.emit('error', { message: 'Authentication required' });
        client.disconnect();
        return;
      }

      // Verify JWT token
      let payload: JwtPayload;
      try {
        payload = this.jwtService.verify<JwtPayload>(token);
      } catch (error) {
        this.logger.warn(`Client ${client.id} rejected - invalid token`);
        client.emit('error', { message: 'Invalid token' });
        client.disconnect();
        return;
      }

      // Check role (only admin and operator can access monitoring)
      if (!['admin', 'operator'].includes(payload.role)) {
        this.logger.warn(`Client ${client.id} rejected - insufficient permissions`);
        client.emit('error', { message: 'Insufficient permissions' });
        client.disconnect();
        return;
      }

      // Store client info
      this.clients.set(client.id, {
        userId: payload.sub,
        username: payload.username || payload.email || payload.sub,
        role: payload.role,
        subscribedStreams: new Set(),
        connectedAt: new Date(),
      });

      this.logger.log(`Client connected: ${client.id} (${payload.username})`);

      // Send connection confirmation
      client.emit('connected', {
        clientId: client.id,
        mikrotikStatus: this.mikrotikService.getConnectionHealth(),
        availableStreams: ['sessions', 'resources', 'traffic'],
      });

    } catch (error: unknown) {
      this.logger.error(`Connection error: ${getErrorMessage(error)}`);
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const clientInfo = this.clients.get(client.id);
    
    if (clientInfo) {
      // Unsubscribe from all streams
      await this.mikrotikService.unsubscribeClient(client.id);
      
      this.logger.log(`Client disconnected: ${client.id} (${clientInfo.username})`);
      this.clients.delete(client.id);
    }
    
    this.requestCounts.delete(client.id);
  }

  /**
   * Rate limiting check
   */
  private checkRateLimit(clientId: string): boolean {
    const now = Date.now();
    let clientRequests = this.requestCounts.get(clientId);

    if (!clientRequests || now > clientRequests.resetAt) {
      // Reset counter
      clientRequests = { count: 0, resetAt: now + 60000 }; // Reset every minute
      this.requestCounts.set(clientId, clientRequests);
    }

    clientRequests.count++;
    return clientRequests.count <= this.MAX_REQUESTS_PER_MINUTE;
  }

  @SubscribeMessage('stream:subscribe')
  async handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { streamType: string; params?: Record<string, string | number | boolean> },
  ) {
    // Rate limiting
    if (!this.checkRateLimit(client.id)) {
      return { success: false, message: 'Rate limit exceeded' };
    }

    const clientInfo = this.clients.get(client.id);
    if (!clientInfo) {
      return { success: false, message: 'Client not registered' };
    }

    const { streamType, params } = data;
    this.logger.log(`Stream subscribe request: ${streamType} from client ${client.id}`);

    let success = false;
    let tag = '';

    switch (streamType) {
      case 'sessions':
        tag = `sessions_${client.id}`;
        success = await this.mikrotikService.subscribeToActiveSessions(
          client.id,
          (data) => {
            client.emit('stream:data', {
              type: 'sessions',
              data,
              timestamp: new Date().toISOString(),
            });
          }
        );
        break;

      case 'resources':
        tag = `resources_${client.id}`;
        success = await this.mikrotikService.subscribeToSystemResources(
          client.id,
          (data) => {
            client.emit('stream:data', {
              type: 'resources',
              data,
              timestamp: new Date().toISOString(),
            });
          }
        );
        break;

      case 'traffic':
        const interfaceName = String(params?.interface || 'ether1');
        tag = `traffic_${client.id}_${interfaceName}`;
        success = await this.mikrotikService.subscribeToInterfaceTraffic(
          client.id,
          interfaceName,
          (data) => {
            client.emit('stream:data', {
              type: 'traffic',
              interface: interfaceName,
              data,
              timestamp: new Date().toISOString(),
            });
          }
        );
        break;

      default:
        return { success: false, message: `Unknown stream type: ${streamType}` };
    }

    if (success) {
      clientInfo.subscribedStreams.add(tag);
      this.logger.log(`Client ${client.id} subscribed to stream ${streamType}`);
    }

    return { success, streamType, tag };
  }

  @SubscribeMessage('stream:unsubscribe')
  async handleUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { streamType: string; params?: Record<string, string | number | boolean> },
  ) {
    const clientInfo = this.clients.get(client.id);
    if (!clientInfo) {
      return { success: false, message: 'Client not registered' };
    }

    const { streamType, params } = data;
    let tag = '';

    switch (streamType) {
      case 'sessions':
        tag = `sessions_${client.id}`;
        break;
      case 'resources':
        tag = `resources_${client.id}`;
        break;
      case 'traffic':
        const interfaceName = String(params?.interface || 'ether1');
        tag = `traffic_${client.id}_${interfaceName}`;
        break;
      default:
        return { success: false, message: `Unknown stream type: ${streamType}` };
    }

    const success = await this.mikrotikService.cancelStream(tag);
    
    if (success) {
      clientInfo.subscribedStreams.delete(tag);
      this.logger.log(`Client ${client.id} unsubscribed from stream ${streamType}`);
    }

    return { success, streamType };
  }

  @SubscribeMessage('stream:unsubscribe-all')
  async handleUnsubscribeAll(@ConnectedSocket() client: Socket) {
    await this.mikrotikService.unsubscribeClient(client.id);
    
    const clientInfo = this.clients.get(client.id);
    if (clientInfo) {
      clientInfo.subscribedStreams.clear();
    }

    this.logger.log(`Client ${client.id} unsubscribed from all streams`);
    return { success: true };
  }

  @SubscribeMessage('stream:ping')
  handlePing(@ConnectedSocket() client: Socket) {
    return { pong: true, timestamp: new Date().toISOString() };
  }

  @SubscribeMessage('status')
  handleStatus(@ConnectedSocket() client: Socket) {
    const clientInfo = this.clients.get(client.id);
    const health = this.mikrotikService.getConnectionHealth();
    const activeStreams = this.mikrotikService.getActiveStreams();

    return {
      client: {
        id: client.id,
        subscribedStreams: clientInfo ? Array.from(clientInfo.subscribedStreams) : [],
        connectedAt: clientInfo?.connectedAt,
      },
      mikrotik: health,
      streams: activeStreams,
      connectedClients: this.clients.size,
    };
  }

  /**
   * Get gateway statistics (for admin dashboard)
   */
  getGatewayStats() {
    return {
      connectedClients: this.clients.size,
      clientDetails: Array.from(this.clients.entries()).map(([id, info]) => ({
        id,
        username: info.username,
        role: info.role,
        subscribedStreams: Array.from(info.subscribedStreams),
        connectedAt: info.connectedAt,
      })),
      activeStreams: this.mikrotikService.getActiveStreams(),
      mikrotikHealth: this.mikrotikService.getConnectionHealth(),
    };
  }
}
