import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // OpenAPI 3.0 (требование API-спецификации)
  const config = new DocumentBuilder()
    .setTitle('Tests API')
    .setDescription('SAP BW Competency Assessment — Tests API (UC-01–UC-03, UC-05)')
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  app.setGlobalPrefix('v1');

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`Tests API listening on port ${port}`);
}

bootstrap();
