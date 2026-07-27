export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    statusCode: number = 500,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = true;
    this.details = details;

    Object.setPrototypeOf(this, AppError.prototype);
  }

  static badRequest(message: string, details?: Record<string, unknown>): AppError {
    return new AppError('BAD_REQUEST', message, 400, details);
  }

  static unauthorized(message: string = 'Unauthorized', details?: Record<string, unknown>): AppError {
    return new AppError('UNAUTHORIZED', message, 401, details);
  }

  static forbidden(message: string = 'Forbidden', details?: Record<string, unknown>): AppError {
    return new AppError('FORBIDDEN', message, 403, details);
  }

  static notFound(resource: string, id?: string): AppError {
    const message = id ? `${resource} with id ${id} not found` : `${resource} not found`;
    return new AppError('NOT_FOUND', message, 404, { resource, id });
  }

  static conflict(message: string, details?: Record<string, unknown>): AppError {
    return new AppError('CONFLICT', message, 409, details);
  }

  static internal(message: string = 'Internal server error', details?: Record<string, unknown>): AppError {
    const error = new AppError('INTERNAL_ERROR', message, 500, details);
    error.isOperational = false;
    return error;
  }

  static validation(errors: z.ZodError): AppError {
    const formatted = errors.flatten().fieldErrors;
    return new AppError('VALIDATION_ERROR', 'Validation failed', 422, { errors: formatted });
  }

  static fromUnknown(error: unknown): AppError {
    if (error instanceof AppError) return error;
    if (error instanceof z.ZodError) return AppError.validation(error);
    if (error instanceof Error) return AppError.internal(error.message, { originalError: error.stack });
    return AppError.internal('Unknown error', { originalError: String(error) });
  }
}

import { z } from 'zod';