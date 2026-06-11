"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, XCircle } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { LogoMark } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useSignIn } from "@/hooks/auth/sign-in";
import { getPostLoginRedirect } from "@/lib/auth/redirect";
import { cn } from "@/lib/utils";

function LoginPageBackground({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-8">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 animate-login-bg-drift">
          <Image
            src="/login_background.png"
            alt=""
            fill
            priority
            className="scale-110 object-cover object-center"
            sizes="100vw"
          />
        </div>
      </div>
      <div className="relative z-10 flex min-h-[calc(100vh-4rem)] items-center justify-center">
        {children}
      </div>
    </div>
  );
}

const inputClassName = cn(
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
  "ring-offset-background transition-colors placeholder:text-muted-foreground",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
  "disabled:cursor-not-allowed disabled:opacity-50",
);

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = getPostLoginRedirect(searchParams);
  const { isLoading: authLoading, isFetched, isAuthenticated } = useAuth();
  const signIn = useSignIn();

  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [err, setErr] = useState(false);

  useEffect(() => {
    if (isFetched && isAuthenticated) {
      router.replace(returnUrl);
    }
  }, [isFetched, isAuthenticated, router, returnUrl]);

  const handleSubmit = async () => {
    if (!email || !pw) {
      setErr(true);
      return;
    }

    setErr(false);

    try {
      await signIn.mutateAsync({ email, password: pw, rememberMe });
      router.push(returnUrl);
    } catch {
      setErr(true);
    }
  };

  if (!isFetched || authLoading) {
    return (
      <LoginPageBackground>
        <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </LoginPageBackground>
    );
  }

  return (
    <LoginPageBackground>
      <div className="w-full max-w-[980px] overflow-hidden rounded-md border border-white/60 bg-card shadow-2xl">
        <div className="flex flex-col md:grid md:grid-cols-2 md:items-stretch">
          {/* Form */}
          <div className="flex flex-col justify-center px-8 py-10 sm:px-10 sm:py-12">
            <div className="mx-auto w-full max-w-[380px]">
              <div className="mb-8 flex items-center gap-2.5">
                <LogoMark size={32} />
                <span className="text-xl font-bold tracking-tight text-foreground">
                  inventory
                </span>
              </div>

              <h1 className="text-[28px] font-bold tracking-tight text-foreground">
                Welcome back
              </h1>
              <p className="mt-1.5 mb-7 text-sm text-muted-foreground">
                Sign in to your account
              </p>

              {err && (
                <div
                  className="mb-4 flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700"
                  role="alert"
                >
                  <XCircle className="size-4 shrink-0" />
                  Invalid email or password.
                </div>
              )}

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label
                    htmlFor="login-email"
                    className="text-sm font-medium text-foreground"
                  >
                    Email address
                  </label>
                  <input
                    id="login-email"
                    className={inputClassName}
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setErr(false);
                    }}
                    disabled={signIn.isPending}
                    autoComplete="email"
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="login-password"
                    className="text-sm font-medium text-foreground"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="login-password"
                      className={cn(inputClassName, "pr-10")}
                      type={show ? "text" : "password"}
                      placeholder="••••••••"
                      value={pw}
                      onChange={(e) => {
                        setPw(e.target.value);
                        setErr(false);
                      }}
                      disabled={signIn.isPending}
                      autoComplete="current-password"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void handleSubmit();
                      }}
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
                      onClick={() => setShow((s) => !s)}
                      tabIndex={-1}
                      aria-label={show ? "Hide password" : "Show password"}
                    >
                      {show ? (
                        <EyeOff className="size-4" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 pt-1">
                  <Checkbox
                    id="login-remember"
                    checked={rememberMe}
                    onCheckedChange={(checked) =>
                      setRememberMe(checked === true)
                    }
                    disabled={signIn.isPending}
                  />
                  <label
                    htmlFor="login-remember"
                    className="cursor-pointer select-none text-sm text-muted-foreground"
                  >
                    Remember me
                  </label>
                </div>
              </div>

              <Button
                className="mt-5 w-full"
                onClick={() => void handleSubmit()}
                disabled={signIn.isPending}
              >
                {signIn.isPending ? "Signing in…" : "Sign in"}
              </Button>
            </div>
          </div>

          {/* Visual */}
          <div className="relative min-h-[360px] overflow-hidden border-t border-border md:h-full md:min-h-0 md:border-l md:border-t-0">
            <Image
              src="/login_image.png"
              alt="Inventory management illustration"
              fill
              className="object-cover object-center"
              sizes="(max-width: 768px) 100vw, 490px"
              priority
            />
            <div className="absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-indigo-950/55 via-indigo-950/25 to-transparent px-6 pb-20 pt-8 sm:px-8 sm:pt-10">
              {/* <p className="mx-auto max-w-[320px] text-center text-sm leading-relaxed text-white drop-shadow-sm">
                Manage your inventory across every store — stock, sales, and
                insights in one place.
              </p> */}
            </div>
          </div>
        </div>
      </div>
    </LoginPageBackground>
  );
}
