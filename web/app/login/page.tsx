"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, XCircle } from "lucide-react";
import { LogoMark } from "@/components/logo";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/store/app";

export default function LoginPage() {
  const router = useRouter();
  const login  = useAppStore((s) => s.login);

  const [email, setEmail] = useState("");
  const [pw,    setPw]    = useState("");
  const [show,  setShow]  = useState(false);
  const [err,   setErr]   = useState(false);

  const doLogin = (role?: "admin" | "manager") => {
    if (role === "admin") {
      login({ name: "Walaa Ahmad", role: "admin", store: null });
      router.push("/dashboard");
      return;
    }
    if (role === "manager") {
      login({ name: "Sara Mansour", role: "manager", store: "Store B — Riverside" });
      router.push("/dashboard");
      return;
    }
    if (!email || !pw) { setErr(true); return; }
    const r = email.includes("manager") ? "manager" as const : "admin" as const;
    const name = r === "admin" ? "Walaa Ahmad" : "Sara Mansour";
    const store = r === "manager" ? "Store B — Riverside" : null;
    login({ name, role: r, store });
    router.push("/dashboard");
  };

  return (
    <div className="login">
      {/* Left decorative panel */}
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

      {/* Right form panel */}
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
              />
              <button className="icon-btn pw-toggle" onClick={() => setShow((s) => !s)} tabIndex={-1}>
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </Field>

          <Button variant="primary" size="lg" block onClick={() => doLogin()}>
            Sign in
          </Button>

          <div className="demo-row">
            <button className="demo-btn" onClick={() => doLogin("admin")}>
              <div className="db-title">Demo · Admin</div>
              <div className="db-sub">walaa@inventory.app</div>
            </button>
            <button className="demo-btn" onClick={() => doLogin("manager")}>
              <div className="db-title">Demo · Branch Manager</div>
              <div className="db-sub">sara@inventory.app</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
