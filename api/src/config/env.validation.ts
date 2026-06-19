import * as Joi from "joi";

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid("development", "production", "test")
    .default("development"),
  DATABASE_URL: Joi.string().required(),
  PORT: Joi.number().default(4000),
  BETTER_AUTH_SECRET: Joi.when("NODE_ENV", {
    is: "production",
    then: Joi.string().min(32).required(),
    otherwise: Joi.string().optional(),
  }),
  BETTER_AUTH_URL: Joi.when("NODE_ENV", {
    is: "production",
    then: Joi.string().uri().required(),
    otherwise: Joi.string().uri().optional(),
  }),
  BETTER_AUTH_TRUSTED_ORIGINS: Joi.when("NODE_ENV", {
    is: "production",
    then: Joi.string().required(),
    otherwise: Joi.string().optional(),
  }),
  ALLOW_SIGNUP: Joi.string().valid("true", "false").optional(),
  APP_TIMEZONE: Joi.string().default("Africa/Mogadishu"),
  R2_ACCOUNT_ID: Joi.string().optional(),
  R2_ACCESS_KEY_ID: Joi.string().optional(),
  R2_SECRET_ACCESS_KEY: Joi.string().optional(),
  R2_BUCKET: Joi.string().optional(),
  R2_ENDPOINT: Joi.string()
    .uri()
    .optional()
    .custom((value, helpers) => {
      if (!value) return value;
      const pathname = new URL(value).pathname.replace(/\/$/, "");
      if (pathname) {
        return helpers.message({
          custom:
            "R2_ENDPOINT must be the account S3 API URL only (no bucket path). Example: https://<account_id>.r2.cloudflarestorage.com",
        });
      }
      return value;
    }),
  STORAGE_LOCAL_PATH: Joi.string().optional(),
});
