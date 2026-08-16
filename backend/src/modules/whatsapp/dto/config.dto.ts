import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpdateConfigDto {
  /** Master switch gateway. */
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  /** Jumlah pesan per nomor sebelum round-robin berganti. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  roundRobinThreshold?: number;

  /** Auto-reconnect saat koneksi putus (non-fatal). */
  @IsOptional()
  @IsBoolean()
  autoReconnect?: boolean;
}

export class ListLogsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @IsOptional()
  status?: string;

  @IsOptional()
  sessionPhone?: string;

  @IsOptional()
  recipientPhone?: string;
}
