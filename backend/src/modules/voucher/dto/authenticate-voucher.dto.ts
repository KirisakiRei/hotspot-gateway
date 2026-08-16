import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class AuthenticateVoucherDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  mac: string;

  @IsString()
  @IsNotEmpty()
  ip: string;

  @IsString()
  @IsOptional()
  linkOrig?: string;
}

export class DisconnectDto {
  @IsString()
  @IsNotEmpty()
  mac: string;
}
