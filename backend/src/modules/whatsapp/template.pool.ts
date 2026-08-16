// ==========================================
// WHATSAPP GATEWAY - Template Pool
// Struktur pesan:
//   [Salam] -> [Header + Kode OTP/Voucher] -> [Cara Menggunakan]
//   -> [Masa Berlaku] -> [Pemberitahuan Pesan Otomatis]
// Variasi tone (formal, casual, gen-z, santai) agar
// tidak terdeteksi sebagai spam identik.
// ==========================================

export interface VoucherTemplatePayload {
  code: string;
  durationText: string;
  validityDays: number;
  /** Base URL portal tanpa trailing slash (template menambahkan /portal). */
  portalUrl: string;
}

type TemplateFn = (p: VoucherTemplatePayload) => string;

const portal = (p: VoucherTemplatePayload) => `${p.portalUrl}/portal`;
const validity = (p: VoucherTemplatePayload) => `${p.validityDays} hari`;

const templates: TemplateFn[] = [
  // ========== FORMAL ==========
  (p) => `
Halo, terima kasih telah menggunakan layanan WiFi Hotspot kami.

*Kode Hotspot WiFi*
━━━━━━━━━━━━━━━━━━━
Kode Voucher: *${p.code}*
Durasi: ${p.durationText}
━━━━━━━━━━━━━━━━━━━

*Cara Menggunakan:*
1. Buka website ${portal(p)}
2. Masukkan kode voucher pada halaman login
3. Nikmati akses internet Anda

Voucher ini hanya dapat digunakan sekali dan berlaku ${validity(p)}.

_Pesan ini dikirim otomatis oleh sistem. Mohon tidak membalas pesan ini._
`.trim(),

  // ========== CASUAL ==========
  (p) => `
Hai! Voucher internet kamu sudah siap.

*Kode Hotspot WiFi*
Kode Voucher: *${p.code}*
Durasi: ${p.durationText}

*Cara pakai:*
1. Buka ${portal(p)}
2. Masukkan kode voucher di halaman login
3. Langsung online dan nikmati internetnya!

Voucher ini sekali pakai dan berlaku ${validity(p)}.

_Pesan otomatis dari Hotspot Gateway._
`.trim(),

  // ========== GEN-Z ==========
  (p) => `
Halo! Voucher kamu udah siap nih.

*Kode Hotspot WiFi*
Kode: *${p.code}*
Durasi: ${p.durationText}

Step by step:
1. Buka ${portal(p)}
2. Masukkan kode di halaman login
3. Selamat internetan!

Voucher sekali pakai, berlaku ${validity(p)}.

_Pesan ini dikirim otomatis oleh sistem._
`.trim(),

  // ========== SANTAI ==========
  (p) => `
Selamat datang di layanan Hotspot WiFi kami.

*Kode Hotspot WiFi*
Kode Voucher: *${p.code}*
Durasi: ${p.durationText}

*Cara menggunakan:*
1. Buka website ${portal(p)}
2. Masukkan kode voucher di halaman login
3. Nikmati akses internet cepat dan stabil!

Voucher ini hanya dapat digunakan sekali dan berlaku ${validity(p)}.

_Pesan otomatis sistem. Tidak perlu dibalas._
`.trim(),
];

let lastIndex = -1;

/**
 * Pilih template acak. Hindari pemakaian template yang sama
 * dua kali beruntun bila memungkinkan.
 */
export function buildVoucherMessage(payload: VoucherTemplatePayload): string {
  let index = Math.floor(Math.random() * templates.length);
  if (index === lastIndex && templates.length > 1) {
    index = (index + 1) % templates.length;
  }
  lastIndex = index;
  return templates[index](payload);
}

/** Format durasi menit -> teks ("2 jam 30 menit"). */
export function formatDuration(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) {
    return minutes > 0 ? `${hours} jam ${minutes} menit` : `${hours} jam`;
  }
  return `${minutes} menit`;
}

const DEFAULT_PUBLIC_PORTAL_URL = 'https://wifi.rekavia.com';

function isPrivateOrLocalUrl(value: string): boolean {
  try {
    const parsed = new URL(value.includes('://') ? value : `http://${value}`);
    const host = parsed.hostname.toLowerCase();
    if (host === 'localhost' || host.endsWith('.local')) return true;
    if (/^10\./.test(host)) return true;
    if (/^192\.168\./.test(host)) return true;
    if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return true;
    if (host === '127.0.0.1' || host === '::1') return true;
    return false;
  } catch {
    return true;
  }
}

/** Normalisasi base URL portal publik (tanpa trailing slash). */
export function normalizePortalUrl(raw: string | null | undefined): string {
  const base = (raw || '').trim().replace(/\/+$/, '');
  if (!base || isPrivateOrLocalUrl(base)) return DEFAULT_PUBLIC_PORTAL_URL;
  return base;
}

/** Pilih URL portal untuk pesan WhatsApp: domain publik, bukan IP lokal. */
export function resolvePublicPortalUrl(
  storedUrl?: string | null,
  envUrl?: string | null,
): string {
  const candidates = [envUrl, storedUrl, DEFAULT_PUBLIC_PORTAL_URL];
  for (const candidate of candidates) {
    const normalized = (candidate || '').trim().replace(/\/+$/, '');
    if (normalized && !isPrivateOrLocalUrl(normalized)) return normalized;
  }
  return DEFAULT_PUBLIC_PORTAL_URL;
}
