import { IsString, IsOptional } from 'class-validator';

export interface RadiusAcceptResponse {
  control: { Auth_Type: string };
  reply: { Session_Timeout: number; 'Mikrotik-Rate-Limit': string };
}

export class RadiusAuthorizeDto {
  @IsString()
  username: string;

  @IsString()
  password: string;

  @IsOptional()
  @IsString()
  nasIdentifier?: string;

  @IsOptional()
  @IsString()
  nasIpAddress?: string;

  @IsOptional()
  @IsString()
  callingStationId?: string; // MAC address client

  @IsOptional()
  @IsString()
  calledStationId?: string;

  @IsOptional()
  @IsString()
  serviceType?: string;
}

export class RadiusAccountingDto {
  @IsString()
  acctStatusType: string; // Start | Interim-Update | Stop

  @IsString()
  username: string;

  @IsOptional()
  @IsString()
  nasIdentifier?: string;

  @IsOptional()
  @IsString()
  nasIpAddress?: string;

  @IsOptional()
  @IsString()
  callingStationId?: string; // MAC address client

  @IsOptional()
  @IsString()
  framedIpAddress?: string;

  @IsOptional()
  @IsString()
  acctSessionId?: string;

  @IsOptional()
  @IsString()
  acctSessionTime?: string;

  @IsOptional()
  @IsString()
  acctInputOctets?: string;

  @IsOptional()
  @IsString()
  acctOutputOctets?: string;

  @IsOptional()
  @IsString()
  acctTerminateCause?: string;
}
