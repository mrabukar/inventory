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
  ALLOW_PUBLIC_SIGNUP: Joi.string().valid("true", "false").optional(),
  APP_TIMEZONE: Joi.string().default("Africa/Mogadishu"),
});
