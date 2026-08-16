import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class AddSessionDto {
  /** Nomor WhatsApp pengirim (format internasional, tanpa '+'). */
  @IsString()
  @Matches(/^\d{8,15}$/, { message: 'Nomor harus 8-15 digit (format internasional, tanpa +)' })
  phone: string;

  /** Label internal untuk memudahkan identifikasi (mis. "Nomor A"). */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;
}
