import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateSessionDto {
  /** Label internal. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  /** false = stop & nonaktifkan dari round-robin; true = aktifkan kembali. */
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
