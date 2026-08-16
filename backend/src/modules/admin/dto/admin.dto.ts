import {
  IsString,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  MinLength,
} from 'class-validator';

export class CreateAdminDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  role: string; // Supports custom roles

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateAdminDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  role?: string; // Supports custom roles

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
