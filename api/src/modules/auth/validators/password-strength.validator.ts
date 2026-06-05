import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from "class-validator";

export function isStrongPassword(password: string): boolean {
  if (typeof password !== "string") return false;
  return (
    /[A-Z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

export const STRONG_PASSWORD_MESSAGE =
  "password must contain at least one uppercase letter, one number, and one special character";

@ValidatorConstraint({ name: "isStrongPassword", async: false })
export class IsStrongPasswordConstraint implements ValidatorConstraintInterface {
  validate(password: string): boolean {
    return isStrongPassword(password);
  }

  defaultMessage(): string {
    return STRONG_PASSWORD_MESSAGE;
  }
}

export function IsStrongPassword(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsStrongPasswordConstraint,
    });
  };
}
