import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('v1/dashboard');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Dashboard API')
    .setDescription(
      'SAP BW Competency Assessment — Dashboard API (UC-13)\n\n' +
      'Сводная аналитика для Director SPA.\n' +
      'GET /v1/dashboard/summary — кэшированная сводка (Redis 5 мин).\n' +
      'POST /v1/dashboard/tasks — тяжёлые агрегации в async-режиме.\n' +
      'GET /v1/dashboard/tasks/:id — статус и результат задачи.\n\n' +
      'Данные поступают через межсервисные HTTP-запросы к reports-api.',
    )
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('v1/dashboard/docs', app, document);

  const port = process.env.PORT ?? 3005;
  await app.listen(port);
  console.log(`Dashboard API listening on port ${port}`);
  console.log(`Swagger: http://localhost:${port}/v1/dashboard/docs`);
}

bootstrap();
