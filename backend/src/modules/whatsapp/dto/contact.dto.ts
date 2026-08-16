import { IsString, Matches } from 'class-validator';

export class CheckNumberDto {
  @IsString()
  @Matches(/^\d{8,15}$/, { message: 'Nomor harus 8-15 digit (format internasional, tanpa +)' })
  phone: string;
}

export class ContactInfoDto extends CheckNumberDto {}
