"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, XCircle } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { LogoMark } from "@/components/logo";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { useSignIn } from "@/lib/auth/hooks";
import { getPostLoginRedirect } from "@/lib/auth/redirect";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = getPostLoginRedirect(searchParams);
  const { isLoading: authLoading, isAuthenticated } = useAuth();
  const signIn = useSignIn();

  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState(false);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.replace(returnUrl);
    }
  }, [authLoading, isAuthenticated, router, returnUrl]);

  const handleSubmit = async () => {
    if (!email || !pw) {
      setErr(true);
      return;
    }

    setErr(false);

    try {
      await signIn.mutateAsync({ email, password: pw });
      router.push(returnUrl);
    } catch {
      setErr(true);
    }
  };

  if (authLoading) {
    return null;
  }

  return (
    <div className="login">
      <div className="login-art">
        <div className="login-brand">
          <LogoMark size={40} />
          <span>inventory</span>
        </div>
        <div className="login-tag">
          Manage your inventory.<br />Across every store.
        </div>
        <div className="login-ministats">
          <div className="ministat"><div className="mk">Total Products</div><div className="mv num">312</div></div>
          <div className="ministat"><div className="mk">Active Stores</div><div className="mv num">4</div></div>
          <div className="ministat"><div className="mk">Monthly Sales</div><div className="mv num">$124.5k</div></div>
        </div>
      </div>

      <div className="login-form">
        <div className="login-card">
          <h1>Welcome back</h1>
          <p className="lc-sub">Sign in to your account</p>

          {err && (
            <div className="alert-error">
              <XCircle size={16} />
              Invalid email or password.
            </div>
          )}

          <Field label="Email address">
            <input
              className="f-input"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setErr(false); }}
              disabled={signIn.isPending}
            />
          </Field>

          <Field label="Password">
            <div className="pw-wrap">
              <input
                className="f-input"
                type={show ? "text" : "password"}
                placeholder="••••••••"
                value={pw}
                onChange={(e) => { setPw(e.target.value); setErr(false); }}
                style={{ paddingRight: 44 }}
                disabled={signIn.isPending}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleSubmit();
                }}
              />
              <button className="icon-btn pw-toggle" onClick={() => setShow((s) => !s)} tabIndex={-1}>
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </Field>

          <Button
            variant="primary"
            size="lg"
            block
            onClick={() => void handleSubmit()}
            disabled={signIn.isPending}
          >
            {signIn.isPending ? "Signing in…" : "Sign in"}
          </Button>
        </div>
      </div>
    </div>
  );
}
