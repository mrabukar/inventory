import { IsIn } from "class-validator";

export const TWO_FACTOR_ACTIONS = ["disable", "require", "reset"] as const;
export type TwoFactorAction = (typeof TWO_FACTOR_ACTIONS)[number];

export class TwoFactorActionDto {
  @IsIn(TWO_FACTOR_ACTIONS)
  action!: TwoFactorAction;
}
