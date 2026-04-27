import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('v1/reports');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Reports API')
    .setDescription(
      'SAP BW Competency Assessment — Reports API (UC-13, UC-14)\n\n' +
      'Аналитические отчёты: распределение грейдов, прогресс KPI, экспорт XLSX.\n' +
      'Роли: hr, director.',
    )
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('v1/reports/docs', app, document);

  const port = process.env.PORT ?? 3004;
  await app.listen(port);
  console.log(`Reports API listening on port ${port}`);
  console.log(`Swagger: http://localhost:${port}/v1/reports/docs`);
}

bootstrap();
