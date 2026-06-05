import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { UserRole } from "@prisma/client";

export type CurrentUserPayload = {
  id: string;
  email: string;
  role: UserRole;
  storeId: string | null;
  isActive: boolean;
};

interface AuthenticatedRequest {
  user?: CurrentUserPayload | null;
  session?: { user?: CurrentUserPayload };
}

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): CurrentUserPayload => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.user ?? request.session!.user!;
  },
);
