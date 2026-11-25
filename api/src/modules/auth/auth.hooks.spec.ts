import { APIError } from "better-auth/api";
import { AuthSignUpHook } from "./auth.hooks";

// The Better-Auth packages are ESM-only; the hook only needs these shapes.
jest.mock("@thallesp/nestjs-better-auth", () => {
  const decorator = () => () => undefined;
  return {
    AuthService: class {},
    Hook: decorator,
    BeforeHook: decorator,
    AfterHook: decorator,
    BeforeCreate: decorator,
    BeforeUpdate: decorator,
    DatabaseHook: decorator,
  };
});
jest.mock("better-auth/api", () => ({
  APIError: class extends Error {
    constructor(
      public status: string,
      public body: { message: string },
    ) {
      super(body?.message);
    }
  },
}));

type Session = { user: { role: string; organizationId?: string } } | null;

function makeHook(session: Session) {
  const prisma = {
    organization: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ hasStores: false, isActive: true }),
    },
  };
  const authService = {
    api: { getSession: jest.fn().mockResolvedValue(session) },
  };
  const hook = new AuthSignUpHook(prisma as never, authService as never);
  const signUp = (body: Record<string, unknown>) =>
    hook.validateSignUp({
      body: { password: "Str0ng!Passw0rd#", ...body },
      headers: new Headers(),
    } as never);
  return { signUp };
}

const limited = { role: "limited_user", organizationId: "org-1" };

describe("limited user sign-up while bootstrap sign-up is open", () => {
  const previous = process.env.ALLOW_SIGNUP;
  beforeAll(() => {
    process.env.ALLOW_SIGNUP = "true";
  });
  afterAll(() => {
    if (previous === undefined) delete process.env.ALLOW_SIGNUP;
    else process.env.ALLOW_SIGNUP = previous;
  });

  it("lets an admin of that organization create one", async () => {
    const { signUp } = makeHook({
      user: { role: "admin", organizationId: "org-1" },
    });
    await expect(signUp(limited)).resolves.toBeUndefined();
  });

  it("lets a super admin create one", async () => {
    const { signUp } = makeHook({ user: { role: "super_admin" } });
    await expect(signUp(limited)).resolves.toBeUndefined();
  });

  it("refuses when nobody is signed in", async () => {
    const { signUp } = makeHook(null);
    await expect(signUp(limited)).rejects.toBeInstanceOf(APIError);
  });

  it("refuses a branch manager", async () => {
    const { signUp } = makeHook({
      user: { role: "branch_manager", organizationId: "org-1" },
    });
    await expect(signUp(limited)).rejects.toBeInstanceOf(APIError);
  });

  it("refuses an admin of another organization", async () => {
    const { signUp } = makeHook({
      user: { role: "admin", organizationId: "org-2" },
    });
    await expect(signUp(limited)).rejects.toBeInstanceOf(APIError);
  });
});
