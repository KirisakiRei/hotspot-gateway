import { IsString, IsOptional, IsInt, IsBoolean, Min, Max } from 'class-validator';

export class CreateRouterDto {
  @IsString()
  name: string; // Identifier NAS, contoh: ROUTER-001

  @IsOptional()
  @IsString()
  location?: string; // contoh: Kafe Lantai 1 / Lobby

  @IsString()
  host: string; // IP Publik atau domain router / IP gateway

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  port?: number; // default 8728 (atau port CoA 3799)

  @IsOptional()
  @IsString()
  radiusSecret?: string; // custom shared secret (opsional, jika beda dengan default)

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
