import { createParamDecorator, ExecutionContext } from "@nestjs/common";

interface AuthenticatedRequest {
  session?: { user?: Record<string, unknown> };
}

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.session?.user ?? null;
  },
);
