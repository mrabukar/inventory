import { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { authSwaggerPaths } from "./auth-swagger.paths";
import { SESSION_COOKIE_NAME } from "../modules/auth/auth.constants";
import { SignInDto } from "../modules/auth/dto/sign-in.dto";
import { SignUpDto } from "../modules/auth/dto/sign-up.dto";

export function setupSwagger(app: INestApplication): void {
  const nodeEnv = process.env.NODE_ENV ?? "development";
  const swaggerEnabled =
    nodeEnv !== "production" || process.env.SWAGGER_ENABLED === "true";

  if (!swaggerEnabled) {
    return;
  }

  const config = new DocumentBuilder()
    .setTitle("Inventory API")
    .setDescription(
      [
        "Multi-location inventory management REST API.",
        "",
        "Auth routes under `/api/auth/*` are served by Better-Auth (documented here for reference).",
        "`GET /api/me` is a Nest alias that returns the session user.",
        "Public sign-up is disabled in production unless ALLOW_PUBLIC_SIGNUP=true.",
        "",
        "Sign-in and sign-out require a matching Origin header (CSRF protection).",
        "",
        "To test protected endpoints:",
        "1. Sign in via `POST /api/auth/sign-in/email` (or sign up in dev).",
        "2. Authorize in Swagger with the `better-auth.session_token` cookie.",
        "3. Call `GET /api/auth/get-session` or `GET /api/me`.",
      ].join("\n"),
    )
    .setVersion("0.1.0")
    .addCookieAuth(SESSION_COOKIE_NAME, {
      type: "apiKey",
      in: "cookie",
      name: SESSION_COOKIE_NAME,
    })
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    extraModels: [SignUpDto, SignInDto],
  });
  document.paths = { ...document.paths, ...authSwaggerPaths };

  SwaggerModule.setup("api/docs", app, document);
}
