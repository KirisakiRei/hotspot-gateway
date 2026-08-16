// ==========================================
// WHATSAPP GATEWAY - Template Pool
// Struktur pesan (sesuai kebutuhan bisnis):
//   [Salam] -> [Header + Kode OTP/Voucher] -> [Cara Menggunakan]
//   -> [Masa Berlaku] -> [Konfirmasi "balas *ya*"]
// Variasi tone (formal, casual, gen-z, santai) agar
// tidak terdeteksi sebagai pesan spam identik.
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
Halo, terima kasih telah menggunakan layanan kami.

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

Apabila pesan ini Anda terima, silakan balas *ya* sebagai konfirmasi.
`.trim(),

  // ========== CASUAL ==========
  (p) => `
Hai! Ada kabar baik nih 🎉

*Kode Hotspot WiFi*
Kode Voucher: *${p.code}*
Durasi: ${p.durationText}

*Cara pakai:*
1. Buka ${portal(p)}
2. Masukkan kode voucher di halaman login
3. Langsung online, deh!

Voucher ini sekali pakai dan berlaku ${validity(p)}.

Kalau pesannya sampai, balas *ya* ya!
`.trim(),

  // ========== GEN-Z ==========
  (p) => `
halooww 👋 voucher kamu udah siap!

*Kode Hotspot WiFi*
Kode: *${p.code}*
Durasi: ${p.durationText}

step by step:
1. buka ${portal(p)}
2. input kode di halaman login
3. gaskeun internetan 🚀

voucher sekali pakai, berlaku ${validity(p)} aja.

btw, kalau ini kamu, reply *ya* dong! 😎
`.trim(),

  // ========== SANTAI ==========
  (p) => `
Assalamualaikum / Selamat pagi 🌤️

*Kode Hotspot WiFi*
Kode Voucher: *${p.code}*
Durasi: ${p.durationText}

*Cara menggunakan:*
1. Buka website ${portal(p)}
2. Masukkan kode voucher di halaman login
3. Nikmati internet gratis!

Voucher ini hanya dapat digunakan sekali dan berlaku ${validity(p)}.

Balas *ya* jika kamu menerima pesan ini
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

/** Normalisasi base URL portal (tanpa trailing slash). */
export function normalizePortalUrl(raw: string | null | undefined): string {
  const base = (raw || '').trim();
  if (!base) return 'http://10.10.10.2';
  return base.replace(/\/+$/, '');
}
