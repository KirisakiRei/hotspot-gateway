import axios from 'axios';

/** Ambil pesan dari unknown error (axios / Error / string). */
export function getErrorMessage(error: unknown, fallback = 'Terjadi kesalahan tidak terduga'): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: unknown; error?: unknown } | undefined;
    if (typeof data?.message === 'string' && data.message.trim() !== '') return data.message;
    if (typeof data?.error === 'string' && data.error.trim() !== '') return data.error;
    if (error.message) return error.message;
  }
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error.trim() !== '') return error;
  return fallback;
}
