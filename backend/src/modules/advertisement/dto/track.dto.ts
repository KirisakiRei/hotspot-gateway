import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class TrackViewDto {
  @IsOptional()
  @IsString()
  deviceType?: string;

  @IsOptional()
  @IsString()
  deviceId?: string;
}

export class TrackCompletionDto {
  @IsInt()
  @Min(0)
  watchTime: number;

  @IsOptional()
  @IsString()
  deviceId?: string;
}

export class TrackSkipDto {
  @IsOptional()
  @IsString()
  deviceId?: string;
}
