import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import helmet from "helmet";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module";
import { setupSwagger } from "./config/swagger.config";
import { parseTrustedOrigins } from "./modules/auth/auth.constants";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
    bufferLogs: true,
  });

  app.useLogger(app.get(Logger));

  app.use(helmet());

  const trustedOrigins = parseTrustedOrigins(
    process.env.BETTER_AUTH_TRUSTED_ORIGINS,
  );
  if (trustedOrigins.length > 0) {
    app.enableCors({
      origin: trustedOrigins,
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    });
  }

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  setupSwagger(app);
  await app.listen(process.env.PORT ?? 4000);
}
void bootstrap();
