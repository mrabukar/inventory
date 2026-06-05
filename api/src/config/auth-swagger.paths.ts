import { getSchemaPath } from "@nestjs/swagger";
import { SignInDto } from "../modules/auth/dto/sign-in.dto";
import { SignUpDto } from "../modules/auth/dto/sign-up.dto";
import { SESSION_COOKIE_NAME } from "../modules/auth/auth.constants";

export const authSwaggerPaths = {
  "/api/auth/sign-up/email": {
    post: {
      tags: ["Auth"],
      summary: "Register with email and password (dev only)",
      description:
        "Handled by Better-Auth. Returns 403 in production unless ALLOW_PUBLIC_SIGNUP=true.",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: getSchemaPath(SignUpDto) },
          },
        },
      },
      responses: {
        "200": { description: "User created; session cookie may be set" },
        "400": { description: "Validation failed" },
        "403": { description: "Public sign-up disabled in production" },
      },
    },
  },
  "/api/auth/sign-in/email": {
    post: {
      tags: ["Auth"],
      summary: "Sign in with email and password",
      description:
        "Handled by Better-Auth. Requires a matching Origin header for CSRF.",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: getSchemaPath(SignInDto) },
          },
        },
      },
      responses: {
        "200": { description: "Session cookie set on success" },
        "401": { description: "Invalid credentials" },
        "400": { description: "Validation failed" },
      },
    },
  },
  "/api/auth/sign-out": {
    post: {
      tags: ["Auth"],
      summary: "Sign out and invalidate session",
      description:
        "Handled by Better-Auth. Requires session cookie and matching Origin header.",
      security: [{ [SESSION_COOKIE_NAME]: [] }],
      responses: {
        "200": { description: "Session cleared" },
        "401": { description: "Not authenticated" },
      },
    },
  },
  "/api/auth/get-session": {
    get: {
      tags: ["Auth"],
      summary: "Get current session",
      description: "Handled by Better-Auth.",
      security: [{ [SESSION_COOKIE_NAME]: [] }],
      responses: {
        "200": { description: "Current user and session" },
        "401": { description: "Not authenticated" },
      },
    },
  },
};
