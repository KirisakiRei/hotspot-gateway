import { ConfigService } from '@nestjs/config';

const MIN_SECRET_LENGTH = 16;

/**
 * Wajibkan secret dari env. Fail-fast saat kosong/terlalu pendek —
 * tidak ada fallback hardcoded agar token/enkripsi tidak dapat dipalsukan.
 */
export function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value || value.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `Missing or too short env var: ${key} (min ${MIN_SECRET_LENGTH} chars). Set it in backend/.env`,
    );
  }
  return value;
}

export function requireSecret(configService: ConfigService, key: string): string {
  const value = configService.get<string>(key);
  if (!value || value.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `Missing or too short env var: ${key} (min ${MIN_SECRET_LENGTH} chars). Set it in backend/.env`,
    );
  }
  return value;
}
