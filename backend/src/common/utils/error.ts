/** Ambil pesan dari unknown error tanpa melempar type-safety. */
export function getErrorMessage(error: unknown, fallback = 'Terjadi kesalahan tidak terduga'): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error.trim() !== '') return error;
  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    if (typeof record.message === 'string' && record.message.trim() !== '') {
      return record.message;
    }
    if (typeof record.code === 'string') return record.code;
  }
  return fallback;
}

/** Prisma unique constraint (P2002). */
export function isPrismaUniqueViolation(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: string }).code === 'P2002',
  );
}

export function getPrismaUniqueTarget(error: unknown): string | undefined {
  if (!error || typeof error !== 'object' || !('meta' in error)) return undefined;
  const meta = (error as { meta?: { target?: unknown } }).meta;
  if (!meta) return undefined;
  if (Array.isArray(meta.target)) return meta.target.map(String).join(',');
  if (typeof meta.target === 'string') return meta.target;
  return undefined;
}
