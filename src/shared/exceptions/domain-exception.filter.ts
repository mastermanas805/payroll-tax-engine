import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { DomainException } from './domain-exceptions';

/**
 * DomainExceptionFilter — maps every error to the canonical envelope:
 *   { error: { code, message, details? } }
 *
 * - DomainException        -> its own status + code + details (NFR-7)
 * - HttpException          -> its status; code derived from the status name
 *   (covers ValidationPipe 400s, TenantGuard 401 UnauthorizedException, etc.)
 * - anything else          -> 500 INTERNAL_ERROR (message hidden)
 *
 * Registered globally in main.ts; @Catch() with no args catches everything.
 */
@Catch()
export class DomainExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DomainExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let status = 500;
    let code = 'INTERNAL_ERROR';
    let message = 'Internal server error';
    let details: unknown;

    if (exception instanceof DomainException) {
      status = exception.status;
      code = exception.code;
      message = exception.message;
      details = exception.details;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      code = this.codeForStatus(status);
      if (typeof body === 'string') {
        message = body;
      } else if (body && typeof body === 'object') {
        const b = body as Record<string, unknown>;
        message = (b.message as string) ?? exception.message;
        // ValidationPipe puts an array of messages under `message`.
        if (Array.isArray(b.message)) {
          message = 'Validation failed';
          details = b.message;
          code = 'VALIDATION_FAILED';
        } else if (b.error) {
          details = b.error;
        }
      }
    } else if (exception instanceof Error) {
      message = exception.message || message;
      this.logger.error(exception.message, exception.stack);
    }

    res.status(status).json({
      error: {
        code,
        message,
        ...(details !== undefined ? { details } : {}),
      },
      path: req?.url,
      timestamp: new Date().toISOString(),
    });
  }

  private codeForStatus(status: number): string {
    switch (status) {
      case 400:
        return 'BAD_REQUEST';
      case 401:
        return 'UNAUTHORIZED';
      case 403:
        return 'FORBIDDEN';
      case 404:
        return 'NOT_FOUND';
      case 409:
        return 'CONFLICT';
      case 422:
        return 'UNPROCESSABLE_ENTITY';
      default:
        return 'HTTP_ERROR';
    }
  }
}
