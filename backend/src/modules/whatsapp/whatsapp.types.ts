// ==========================================
// WHATSAPP GATEWAY - Shared Types
// ==========================================

export const SessionStates = ['DISCONNECTED', 'CONNECTING', 'CONNECTED', 'CLOSING'] as const;
export type SessionState = (typeof SessionStates)[number];

export const MessageLogStatuses = ['PENDING', 'SENT', 'FAILED', 'RECEIVED', 'REJECTED'] as const;
export type MessageLogStatus = (typeof MessageLogStatuses)[number];

export const MessageTypes = ['TEXT', 'VOUCHER', 'INCOMING'] as const;
export type MessageType = (typeof MessageTypes)[number];

export interface SessionStatus {
  phone: string;
  name: string | null;
  active: boolean;
  state: SessionState;
  paired: boolean;
  qrAvailable: boolean;
  sentCount: number;
  pairedAt: Date | null;
  lastSeenAt: Date | null;
  lastError: string | null;
}

export interface IncomingMessage {
  from: string; // nomor pengirim (format internasional tanpa '+')
  text: string;
  messageId: string;
}

export interface SendResult {
  ok: boolean;
  messageId?: string;
  error?: string;
}

/** Normalisasi nomor: hanya digit, strip '+', ' ', '-'. */
export function normalizePhone(phone: string): string {
  return phone.replace(/[^\d]/g, '');
}

/** Jid WhatsApp untuk nomor (format internasional). */
export function toJid(phone: string): string {
  return `${normalizePhone(phone)}@s.whatsapp.net`;
}

/** Ambil nomor murni dari jid (`628xx@s.whatsapp.net` -> `628xx`). */
export function fromJid(jid: string | null | undefined): string | null {
  if (!jid) return null;
  const match = jid.match(/^(\d+)@s\.whatsapp\.net$/);
  return match ? match[1] : null;
}
