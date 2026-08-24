import { IsString, IsEnum, IsOptional, IsBoolean, IsInt, IsArray, Min, Max } from 'class-validator';

export type QuestionnaireFieldType = 'TEXT' | 'EMAIL' | 'PHONE' | 'NUMBER' | 'SELECT' | 'TEXTAREA';
const QUESTIONNAIRE_FIELD_TYPES: QuestionnaireFieldType[] = ['TEXT', 'EMAIL', 'PHONE', 'NUMBER', 'SELECT', 'TEXTAREA'];

export class CreateQuestionnaireFieldDto {
  @IsString()
  key: string;

  @IsString()
  label: string;

  @IsEnum(QUESTIONNAIRE_FIELD_TYPES)
  type: QuestionnaireFieldType;

  @IsOptional()
  @IsArray()
  options?: string[];

  @IsOptional()
  @IsString()
  placeholder?: string;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(999)
  order?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateQuestionnaireFieldDto {
  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsEnum(QUESTIONNAIRE_FIELD_TYPES)
  type?: QuestionnaireFieldType;

  @IsOptional()
  @IsArray()
  options?: string[];

  @IsOptional()
  @IsString()
  placeholder?: string;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(999)
  order?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ReorderFieldsDto {
  @IsArray()
  orderedIds: string[];
}

export class SubmitQuestionnaireDto {
  @IsString()
  mac: string;

  @IsOptional()
  @IsString()
  voucherId?: string;

  @IsArray()
  answers: Array<{ key: string; label: string; value: string }>;
}
