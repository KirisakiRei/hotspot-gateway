import {
  IsString,
  IsEnum,
  IsInt,
  IsBoolean,
  IsOptional,
  Min,
  Max,
  IsObject,
  IsDateString,
  ValidateIf,
} from 'class-validator';
import { VideoType } from '@prisma/client';

export class CreateAdvertisementDto {
  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(VideoType)
  videoType: VideoType;

  @IsString()
  videoUrl: string;

  @IsString()
  @IsOptional()
  thumbnailUrl?: string;

  @IsInt()
  @Min(1)
  duration: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  displayDuration?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  startTime?: number = 0;

  @IsInt()
  @Min(1)
  @IsOptional()
  endTime?: number;

  @IsBoolean()
  @IsOptional()
  skipable?: boolean = true;

  @IsInt()
  @Min(0)
  @IsOptional()
  skipAfter?: number = 5;

  @IsInt()
  @Min(0)
  @Max(100)
  @IsOptional()
  priority?: number = 0;

  @IsInt()
  @Min(1)
  @IsOptional()
  weight?: number = 1;

  @IsInt()
  @Min(1)
  @IsOptional()
  maxViewsPerDay?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean = false;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsObject()
  @IsOptional()
  targeting?: {
    timeSlots?: string[];
    daysOfWeek?: number[];
    deviceTypes?: string[];
  };

  @IsString()
  @IsOptional()
  fallbackAdId?: string;
}
