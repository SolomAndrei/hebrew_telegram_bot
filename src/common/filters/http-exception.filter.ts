import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';

type ErrorResponseBody = {
  statusCode: number;
  message: string | string[];
  error: string;
  path: string;
  timestamp: string;
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<FastifyRequest>();
    const response = context.getResponse<FastifyReply>();
    const statusCode = this.getStatusCode(exception);

    if (!(exception instanceof HttpException)) {
      this.logger.error(
        `${request.method} ${request.url} failed with ${statusCode}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    void response.status(statusCode).send(
      this.buildResponseBody(exception, statusCode, request.url),
    );
  }

  private getStatusCode(exception: unknown): number {
    if (exception instanceof HttpException) {
      return exception.getStatus();
    }

    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private buildResponseBody(
    exception: unknown,
    statusCode: number,
    path: string,
  ): ErrorResponseBody {
    if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse();

      return {
        statusCode,
        message: this.getHttpExceptionMessage(exceptionResponse),
        error: this.getHttpExceptionError(exceptionResponse, exception.name),
        path,
        timestamp: new Date().toISOString(),
      };
    }

    return {
      statusCode,
      message: 'Internal server error',
      error: 'Internal Server Error',
      path,
      timestamp: new Date().toISOString(),
    };
  }

  private getHttpExceptionMessage(response: string | object): string | string[] {
    if (typeof response === 'string') {
      return response;
    }

    if (this.isRecord(response)) {
      const message = response.message;

      if (typeof message === 'string' || this.isStringArray(message)) {
        return message;
      }
    }

    return 'Request failed';
  }

  private getHttpExceptionError(response: string | object, fallback: string): string {
    if (this.isRecord(response) && typeof response.error === 'string') {
      return response.error;
    }

    return fallback;
  }

  private isStringArray(value: unknown): value is string[] {
    return Array.isArray(value) && value.every((item) => typeof item === 'string');
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }
}
