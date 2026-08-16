import type { JsonValue } from '@/common/types/json';

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: {
    code: string;
    details?: JsonValue;
  };
}

export class ApiResponseDto<T = unknown> implements ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  error?: {
    code: string;
    details?: JsonValue;
  };

  constructor(
    success: boolean,
    message: string,
    data?: T,
    error?: { code: string; details?: JsonValue },
  ) {
    this.success = success;
    this.message = message;
    this.data = data;
    this.error = error;
  }

  static success<T>(message: string, data?: T): ApiResponseDto<T> {
    return new ApiResponseDto(true, message, data);
  }

  static error(message: string, code: string, details?: JsonValue): ApiResponseDto<undefined> {
    return new ApiResponseDto(false, message, undefined, { code, details });
  }
}
