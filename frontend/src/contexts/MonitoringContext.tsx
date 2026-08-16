import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useToast } from '@/hooks/use-toast';

// Types
export interface SystemResources {
  cpuLoad: number;
  freeMemory: number;
  totalMemory: number;
  freeHddSpace: number;
  totalHddSpace: number;
  uptime: string;
  version: string;
  boardName: string;
}

export interface ActiveSession {
  id: string;
  user: string;
  address: string;
  macAddress: string;
  uptime: string;
  bytesIn: number;
  bytesOut: number;
  idleTime: string;
}

export interface SessionsData {
  totalSessions: number;
  totalBytesIn: number;
  totalBytesOut: number;
  sessions: ActiveSession[];
}

export interface InterfaceStats {
  name: string;
  rxBytes: number;
  txBytes: number;
  rxPackets: number;
  txPackets: number;
  rxErrors: number;
  txErrors: number;
  running: boolean;
}

export interface MonitoringData {
  resources: SystemResources | null;
  sessions: SessionsData | null;
  traffic: InterfaceStats | null;
}

export interface MonitoringContextType {
  // Connection state
  connected: boolean;
  mode: 'streaming' | 'polling' | 'disconnected';
  
  // Data
  data: MonitoringData;
  
  // Actions
  subscribe: (streamType: 'sessions' | 'resources' | 'traffic', params?: Record<string, string | number | boolean>) => void;
  unsubscribe: (streamType: 'sessions' | 'resources' | 'traffic', params?: Record<string, string | number | boolean>) => void;
  unsubscribeAll: () => void;
  
  // Status
  subscribedStreams: string[];
  lastUpdate: Date | null;
  error: string | null;
}

const MonitoringContext = createContext<MonitoringContextType | undefined>(undefined);

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace(/\/api\/?$/, '');
const WS_URL = API_BASE_URL.replace(/^http/, 'ws');

interface MonitoringProviderProps {
  children: React.ReactNode;
}

export function MonitoringProvider({ children }: MonitoringProviderProps) {
  const { toast } = useToast();
  
  // Connection state
  const [connected, setConnected] = useState(false);
  const [mode, setMode] = useState<'streaming' | 'polling' | 'disconnected'>('disconnected');
  const [error, setError] = useState<string | null>(null);
  
  // Subscribed streams
  const [subscribedStreams, setSubscribedStreams] = useState<string[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  
  // Monitoring data
  const [data, setData] = useState<MonitoringData>({
    resources: null,
    sessions: null,
    traffic: null,
  });
  
  // Socket ref
  const socketRef = useRef<Socket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 3;
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Get auth token
  const getToken = useCallback(() => {
    return localStorage.getItem('access_token') || '';
  }, []);

  // Connect to WebSocket
  const connectWebSocket = useCallback(() => {
    const token = getToken();
    
    if (!token) {
      console.warn('No auth token available for WebSocket connection');
      setMode('disconnected');
      return;
    }

    // Disconnect existing socket
    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    console.log('🔌 Connecting to WebSocket...');

    const socket = io(`${API_BASE_URL}/mikrotik`, {
      query: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socket.on('connect', () => {
      console.log('✅ WebSocket connected');
      setConnected(true);
      setMode('streaming');
      setError(null);
      reconnectAttemptsRef.current = 0;
      
      // Stop polling if was in polling mode
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    });

    socket.on('connected', (data) => {
      console.log('📡 Mikrotik connection info:', data);
    });

    socket.on('stream:data', (streamData) => {
      const { type, data: rawData, timestamp } = streamData;
      setLastUpdate(new Date(timestamp));
      
      setData(prev => {
        switch (type) {
          case 'resources':
            // Parse system resources
            if (rawData && rawData.length > 0) {
              const res = rawData[0];
              return {
                ...prev,
                resources: {
                  cpuLoad: parseInt(res['cpu-load'] || '0'),
                  freeMemory: parseInt(res['free-memory'] || '0'),
                  totalMemory: parseInt(res['total-memory'] || '0'),
                  freeHddSpace: parseInt(res['free-hdd-space'] || '0'),
                  totalHddSpace: parseInt(res['total-hdd-space'] || '0'),
                  uptime: res.uptime || '0s',
                  version: res.version || 'Unknown',
                  boardName: res['board-name'] || 'Unknown',
                },
              };
            }
            return prev;
            
          case 'sessions':
            // Parse active sessions
            if (rawData) {
              const sessions = rawData.map((s: Record<string, string>) => ({
                id: s['.id'] || s.id,
                user: s.user || '',
                address: s.address || '',
                macAddress: s['mac-address'] || '',
                uptime: s.uptime || '0s',
                bytesIn: parseInt(s['bytes-in'] || '0'),
                bytesOut: parseInt(s['bytes-out'] || '0'),
                idleTime: s['idle-time'] || '0s',
              }));
              
              const totalBytesIn = sessions.reduce((sum, session) => sum + session.bytesIn, 0);
              const totalBytesOut = sessions.reduce((sum, session) => sum + session.bytesOut, 0);
              
              return {
                ...prev,
                sessions: {
                  totalSessions: sessions.length,
                  totalBytesIn,
                  totalBytesOut,
                  sessions,
                },
              };
            }
            return prev;
            
          case 'traffic':
            // Parse interface traffic
            if (rawData && rawData.length > 0) {
              const iface = rawData[0];
              return {
                ...prev,
                traffic: {
                  name: iface.name || 'ether1',
                  rxBytes: parseInt(iface['rx-byte'] || '0'),
                  txBytes: parseInt(iface['tx-byte'] || '0'),
                  rxPackets: parseInt(iface['rx-packet'] || '0'),
                  txPackets: parseInt(iface['tx-packet'] || '0'),
                  rxErrors: parseInt(iface['rx-error'] || '0'),
                  txErrors: parseInt(iface['tx-error'] || '0'),
                  running: iface.running === 'true',
                },
              };
            }
            return prev;
            
          default:
            return prev;
        }
      });
    });

    socket.on('stream:error', (errorData) => {
      console.error('Stream error:', errorData);
      setError(errorData.message || 'Gagal memperbarui data pemantauan');
    });

    socket.on('error', (errorData) => {
      console.error('Socket error:', errorData);
      setError(errorData.message || 'Koneksi pemantauan terputus');
    });

    socket.on('disconnect', (reason) => {
      console.log('❌ WebSocket disconnected:', reason);
      setConnected(false);
      
      if (reason === 'io server disconnect') {
        // Server disconnected us - don't reconnect
        setMode('disconnected');
        setError('Terputus dari server');
      }
    });

    socket.on('reconnect_attempt', (attempt) => {
      console.log(`🔄 Reconnect attempt ${attempt}/${maxReconnectAttempts}`);
      reconnectAttemptsRef.current = attempt;
    });

    socket.on('reconnect_failed', () => {
      console.log('❌ Reconnection failed, switching to polling mode');
      setMode('polling');
      setError('Pembaruan langsung tidak tersedia. Data diperbarui secara berkala.');
      startPolling();
    });

    socketRef.current = socket;
  }, [getToken, toast]);

  // Start polling fallback
  const startPolling = useCallback(async () => {
    if (pollingIntervalRef.current) return;

    console.log('📊 Starting polling mode...');
    
    const poll = async () => {
      try {
        const token = getToken();
        const response = await fetch(`${API_BASE_URL}/api/mikrotik/monitoring/dashboard`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        
        if (response.ok) {
          const dashboardData = await response.json();
          setLastUpdate(new Date());
          
          // Respon dibungkus ApiResponseDto → data sebenarnya di .data
          const payload = dashboardData.data ?? dashboardData;
          
          setData({
            resources: payload.system || null,
            sessions: payload.sessions || null,
            traffic: payload.interface || null,
          });
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    };

    // Initial poll
    await poll();
    
    // Poll every 10 seconds
    pollingIntervalRef.current = setInterval(poll, 10000);
  }, [getToken]);

  // Subscribe to a stream
  const subscribe = useCallback((
    streamType: 'sessions' | 'resources' | 'traffic',
    params?: Record<string, string | number | boolean>
  ) => {
    if (!socketRef.current || !connected) {
      console.warn('Cannot subscribe - not connected');
      return;
    }

    socketRef.current.emit('stream:subscribe', { streamType, params }, (response: { success?: boolean; tag?: string; message?: string }) => {
      if (response.success) {
        setSubscribedStreams(prev => [...prev, response.tag || streamType]);
        console.log(`✅ Subscribed to ${streamType}`);
      } else {
        console.error(`Failed to subscribe to ${streamType}:`, response.message);
      }
    });
  }, [connected]);

  // Unsubscribe from a stream
  const unsubscribe = useCallback((
    streamType: 'sessions' | 'resources' | 'traffic',
    params?: Record<string, string | number | boolean>
  ) => {
    if (!socketRef.current) return;

    socketRef.current.emit('stream:unsubscribe', { streamType, params }, (response: { success?: boolean }) => {
      if (response.success) {
        setSubscribedStreams(prev => prev.filter(s => !s.includes(streamType)));
        console.log(`❌ Unsubscribed from ${streamType}`);
      }
    });
  }, []);

  // Unsubscribe from all streams
  const unsubscribeAll = useCallback(() => {
    if (!socketRef.current) return;

    socketRef.current.emit('stream:unsubscribe-all', {}, (response: { success?: boolean }) => {
      if (response.success) {
        setSubscribedStreams([]);
        console.log('❌ Unsubscribed from all streams');
      }
    });
  }, []);

  // Connect on mount
  useEffect(() => {
    connectWebSocket();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [connectWebSocket]);

  // Retry WebSocket connection periodically when in polling mode
  useEffect(() => {
    if (mode === 'polling') {
      const retryInterval = setInterval(() => {
        console.log('🔄 Retrying WebSocket connection...');
        connectWebSocket();
      }, 60000); // Retry every 60 seconds

      return () => clearInterval(retryInterval);
    }
  }, [mode, connectWebSocket]);

  const value: MonitoringContextType = {
    connected,
    mode,
    data,
    subscribe,
    unsubscribe,
    unsubscribeAll,
    subscribedStreams,
    lastUpdate,
    error,
  };

  return (
    <MonitoringContext.Provider value={value}>
      {children}
    </MonitoringContext.Provider>
  );
}

export function useMonitoring() {
  const context = useContext(MonitoringContext);
  if (context === undefined) {
    throw new Error('useMonitoring must be used within a MonitoringProvider');
  }
  return context;
}

/**
 * Hook to auto-subscribe to streams
 */
export function useMonitoringStreams(
  streamTypes: Array<'sessions' | 'resources' | 'traffic'>,
  params?: Record<string, string | number | boolean>
) {
  const { connected, subscribe, unsubscribe, data, mode, lastUpdate, error } = useMonitoring();

  useEffect(() => {
    if (connected && mode === 'streaming') {
      // Subscribe to all requested streams
      streamTypes.forEach(type => {
        subscribe(type, params);
      });

      // Cleanup on unmount
      return () => {
        streamTypes.forEach(type => {
          unsubscribe(type, params);
        });
      };
    }
  }, [connected, mode, streamTypes.join(','), JSON.stringify(params)]);

  return { data, mode, lastUpdate, error, connected };
}
