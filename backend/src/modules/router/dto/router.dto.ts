import { IsString, IsOptional, IsInt, IsBoolean, Min, Max } from 'class-validator';

export class CreateRouterDto {
  @IsString()
  name: string; // Identifier NAS (MikroTik System Identity), contoh: ROUTER-001

  @IsOptional()
  @IsString()
  location?: string; // contoh: Kafe Lantai 1 / Cabang A

  @IsOptional()
  @IsString()
  host?: string; // IP Publik sumber (opsional, auto-terdeteksi dari RADIUS packet)

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  port?: number;

  @IsOptional()
  @IsString()
  radiusSecret?: string;

  @IsOptional()
  @IsString()
  status?: 'ACTIVE' | 'DISABLED';
}

export class UpdateRouterDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  host?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  port?: number;

  @IsOptional()
  @IsString()
  radiusSecret?: string;

  @IsOptional()
  @IsString()
  status?: 'ACTIVE' | 'DISABLED';
}
