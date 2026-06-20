"use client";
import { useRef, useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { PanelLeft, Sun, Moon, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSignOut } from "@/hooks/auth/sign-out";
import { useAppStore } from "@/store/app";
import { appRoleLabel } from "@/lib/types";
import { initials } from "@/lib/utils";

interface Props {
  title: string;
  collapsed: boolean;
  onToggle: () => void;
}

export function Navbar({ title, collapsed, onToggle }: Props) {
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const signOut = useSignOut();
  const user = useAppStore((s) => s.user);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const handleLogout = () => {
    setOpen(false);
    void signOut.mutateAsync().then(() => {
      router.replace("/login");
    });
  };

  const ini = user ? initials(user.name) : "?";

  return (
    <header className="navbar">
      <div className="nb-left">
        <button className="icon-btn" onClick={onToggle} title="Toggle sidebar">
          <PanelLeft size={19} />
        </button>
        <span className="nb-title">{title}</span>
      </div>

      <div className="nb-right">
        <button
          className="icon-btn"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}
        </button>

        <div className="av-menu" ref={ref}>
          <button className="avatar" onClick={() => setOpen((o) => !o)}>{ini}</button>
          {open && (
            <div className="av-dropdown">
              <div className="av-who">
                <div className="av-name">{user?.name}</div>
                <div className="av-role">{appRoleLabel(user?.role)}</div>
              </div>
              <button className="danger" onClick={handleLogout}>
                <LogOut size={16} />Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
