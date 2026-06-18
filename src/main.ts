import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { DomainExceptionFilter } from './shared/exceptions/domain-exception.filter';

/**
 * Application bootstrap.
 *
 * - global prefix /api/v1 for all routes EXCEPT the statically served SPA ('/').
 * - global ValidationPipe { whitelist, transform } strips unknown props + coerces DTOs.
 * - global DomainExceptionFilter emits the { error: { code, message, details } } envelope.
 * - CORS enabled. Listens on PORT || 3000.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/v1', {
    exclude: ['/', '/index.html'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new DomainExceptionFilter());
  app.enableCors();

  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  await app.listen(port);
  new Logger('Bootstrap').log(`Payroll Tax Engine listening on :${port} (api base /api/v1)`);
}

void bootstrap();
