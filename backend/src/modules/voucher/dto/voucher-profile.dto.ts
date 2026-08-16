import {
  IsString,
  IsInt,
  IsBoolean,
  IsOptional,
  Min,
  IsNumber,
} from 'class-validator';

export class CreateVoucherProfileDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsInt()
  @Min(1)
  duration: number; // in minutes

  @IsNumber()
  @IsOptional()
  quota?: number; // in bytes

  @IsInt()
  @IsOptional()
  uploadSpeed?: number; // in kbps

  @IsInt()
  @IsOptional()
  downloadSpeed?: number; // in kbps

  @IsInt()
  @Min(1)
  @IsOptional()
  sharedUsers?: number = 1;

  @IsInt()
  @Min(1)
  @IsOptional()
  validityDays?: number = 30;

  @IsNumber()
  @IsOptional()
  price?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean = true;
}

export class UpdateVoucherProfileDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  duration?: number;

  @IsNumber()
  @IsOptional()
  quota?: number;

  @IsInt()
  @IsOptional()
  uploadSpeed?: number;

  @IsInt()
  @IsOptional()
  downloadSpeed?: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  sharedUsers?: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  validityDays?: number;

  @IsNumber()
  @IsOptional()
  price?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
