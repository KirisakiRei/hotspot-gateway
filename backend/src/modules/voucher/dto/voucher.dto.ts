import { IsString, IsInt, IsOptional, Min, Max, IsNotEmpty, IsIn, MaxLength } from 'class-validator';

export class GenerateVoucherDto {
  @IsString()
  @IsNotEmpty()
  profileId: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsString()
  @MaxLength(2)
  @IsOptional()
  prefix?: string; // Max 2 karakter agar sisa 4 digit untuk generate

  @IsInt()
  @Min(4)
  @Max(6)
  @IsOptional()
  length?: number; // Total length max 6 (termasuk prefix)

  @IsString()
  @IsIn(['number', 'text', 'mixed', 'mixed_upper'])
  @IsOptional()
  format?: 'number' | 'text' | 'mixed' | 'mixed_upper';

  @IsString()
  @IsOptional()
  batchName?: string;

  @IsString()
  @IsOptional()
  createdBy?: string;
}

export class RequestVoucherDto {
  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsString()
  @IsOptional()
  mac?: string;

  @IsString()
  @IsOptional()
  ip?: string;
}

export class RedeemVoucherDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsOptional()
  mac?: string;

  @IsString()
  @IsOptional()
  ip?: string;
}
