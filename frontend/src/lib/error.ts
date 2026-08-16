import axios from 'axios';

const TECHNICAL_PATTERNS = [
  /request failed with status code/i,
  /network error/i,
  /timeout of \d+ms exceeded/i,
  /econnrefused/i,
  /enotfound/i,
  /socket hang up/i,
  /unexpected token/i,
  /cannot read propert/i,
  /undefined is not/i,
  /prisma/i,
  /axios/i,
  /status code/i,
  /internal server error/i,
  /no active advertisement/i,
];

function isTechnicalMessage(message: string): boolean {
  const value = message.trim();
  if (!value) return true;
  if (TECHNICAL_PATTERNS.some((pattern) => pattern.test(value))) return true;
  if (/^[A-Z_]+$/.test(value) && value.length > 8) return true;
  return false;
}

function pickFirstMessage(...candidates: unknown[]): string | null {
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    const value = candidate.trim();
    if (!value || isTechnicalMessage(value)) continue;
    return value;
  }
  return null;
}

/** Ambil pesan yang aman ditampilkan ke pengguna. */
export function getErrorMessage(error: unknown, fallback = 'Terjadi gangguan. Silakan coba lagi.'): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: unknown; error?: unknown } | undefined;
    const fromBody = pickFirstMessage(data?.message, data?.error);
    if (fromBody) return fromBody;

    const status = error.response?.status;
    if (status === 401) return 'Sesi Anda telah berakhir. Silakan masuk kembali.';
    if (status === 403) return 'Anda tidak memiliki akses untuk tindakan ini.';
    if (status === 404) return 'Data yang diminta tidak ditemukan.';
    if (status === 429) return 'Terlalu banyak permintaan. Mohon tunggu sebentar.';
    if (status && status >= 500) return 'Server sedang mengalami gangguan. Silakan coba lagi.';
    if (!error.response) return 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.';
  }

  if (error instanceof Error) {
    const safe = pickFirstMessage(error.message);
    if (safe) return safe;
  }

  if (typeof error === 'string') {
    const safe = pickFirstMessage(error);
    if (safe) return safe;
  }

  return fallback;
}
