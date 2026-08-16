import type { RStream } from 'node-routeros';
import type { JsonValue } from '@/common/types/json';

/** Record generik dari RouterOS (key string, value string/number/boolean). */
export type MikrotikRecord = Record<string, string | number | boolean | undefined>;

export interface HotspotUserRecord extends MikrotikRecord {
  '.id': string;
  name: string;
  profile?: string;
  password?: string;
  'mac-address'?: string;
  comment?: string;
  disabled?: string;
}

export interface HotspotSessionRecord extends MikrotikRecord {
  '.id': string;
  user?: string;
  address?: string;
  'mac-address'?: string;
  mac?: string;
  uptime?: string;
  'bytes-in'?: string;
  'bytes-out'?: string;
  server?: string;
  'session-time-left'?: string;
}

export interface HotspotProfileRecord extends MikrotikRecord {
  '.id': string;
  name: string;
  'shared-users'?: string;
  'rate-limit'?: string;
}

export interface SystemResourcesRecord extends MikrotikRecord {
  'cpu-load'?: string;
  'free-memory'?: string;
  'total-memory'?: string;
  uptime?: string;
  version?: string;
  'board-name'?: string;
}

export interface StreamListenPayload {
  tag: string;
  command?: string;
  data?: MikrotikRecord;
  type?: string;
  timestamp?: string;
  error?: string;
}

export interface ActiveStreamInfo {
  command: string;
  startedAt: Date;
  dataCount: number;
  stream?: RStream;
  timeoutId?: ReturnType<typeof setTimeout>;
  interval?: ReturnType<typeof setInterval>;
}

export interface JwtPayload {
  sub: string;
  email?: string;
  username?: string;
  role: string;
}

export interface RouterOsErrorLike {
  message?: string;
  errno?: string | number;
  code?: string | number;
}

export interface RosApiMenu {
  menu: (path: string) => RosApiMenu;
  where: (clause: Record<string, string | number | boolean>) => RosApiMenu;
  stream: (
    action: string,
    callback: (err: Error | null, data: MikrotikRecord, stream: RStream) => void,
  ) => RStream;
  getOnly?: () => Promise<MikrotikRecord>;
  rosApi?: unknown;
}

export interface SocketLike {
  listeners: (event: string) => Array<(...args: unknown[]) => void>;
  removeAllListeners: (event: string) => void;
  on: (event: string, listener: (data: Buffer) => void) => void;
}

export interface RouterOsConnector {
  socket?: SocketLike;
  receiver?: unknown;
}

export interface RouterOsClientInternals {
  connector?: RouterOsConnector;
}

export function extractRouterOsApi(menu: RosApiMenu): import('node-routeros').RouterOSAPI | null {
  const candidate = menu.rosApi ?? menu;
  if (candidate && typeof candidate === 'object' && 'write' in candidate && 'on' in candidate) {
    return candidate as import('node-routeros').RouterOSAPI;
  }
  return null;
}

export function isRouterOsError(error: unknown): error is RouterOsErrorLike {
  return Boolean(error && typeof error === 'object');
}

export function getRouterOsCode(error: unknown): string | number | undefined {
  if (!isRouterOsError(error)) return undefined;
  if (error.errno !== undefined) return error.errno;
  if (error.code !== undefined) return error.code;
  return undefined;
}

export function toJsonValue(value: unknown): JsonValue {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(toJsonValue);
  }
  if (value && typeof value === 'object') {
    const out: Record<string, JsonValue> = {};
    for (const [key, entry] of Object.entries(value)) {
      out[key] = toJsonValue(entry);
    }
    return out;
  }
  return String(value);
}
