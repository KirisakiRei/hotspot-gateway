/**
 * Normalisasi MAC address ke satu format standar:
 * uppercase + separator ':' (contoh: 4A:F4:A0:95:92:95)
 * Handle input: '4a-f4-a0-95-92-95', '4AF4A0959295', '4a:f4:a0:95:92:95', dll.
 */
export function normalizeMac(mac?: string | null): string | null {
  if (!mac) return null;

  const cleaned = mac.trim().toUpperCase().replace(/[^0-9A-F]/g, '');
  if (cleaned.length === 12) {
    return cleaned.match(/.{2}/g)!.join(':');
  }
  // Input tidak standar — kembalikan uppercase polos agar tidak rusak
  return mac.trim().toUpperCase();
}
