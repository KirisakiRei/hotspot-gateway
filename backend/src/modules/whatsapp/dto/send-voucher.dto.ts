import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmptyObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

class VoucherProfileDto {
  @IsString()
  @MaxLength(200)
  name: string;

  /** Durasi dalam menit. */
  @IsInt()
  @Min(1)
  duration: number;

  /** Kuota dalam byte; null = unlimited. */
  @IsOptional()
  @IsInt()
  @Min(0)
  quota?: number;

  /** Masa berlaku dalam hari (default 30). */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  validityDays?: number;
}

export class SendVoucherDto {
  /** Nomor penerima (format internasional, tanpa '+'). */
  @IsString()
  @Matches(/^\d{8,15}$/, { message: 'Nomor harus 8-15 digit (format internasional, tanpa +)' })
  phone: string;

  /** Kode voucher yang akan dikirim. */
  @IsString()
  @MaxLength(50)
  voucherCode: string;

  @IsNotEmptyObject()
  @ValidateNested()
  @Type(() => VoucherProfileDto)
  profile: VoucherProfileDto;
}
