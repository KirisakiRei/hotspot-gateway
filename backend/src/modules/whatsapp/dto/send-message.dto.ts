import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class SendMessageDto {
  /** Nomor penerima (format internasional, tanpa '+'). */
  @IsString()
  @Matches(/^\d{8,15}$/, { message: 'Nomor harus 8-15 digit (format internasional, tanpa +)' })
  phone: string;

  /** Isi pesan teks. */
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  message: string;
}
