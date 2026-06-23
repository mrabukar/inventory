"use client";
import { useTheme } from "next-themes";
import { PanelLeft, Sun, Moon, LogOut, User } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSignOut } from "@/hooks/auth/sign-out";
import { useAppStore } from "@/store/app";
import { appRoleLabel } from "@/lib/types";
import { initials } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

  const handleLogout = () => {
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

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="avatar" type="button" aria-label="Account menu">
              {ini}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={8} className="w-56">
            <div className="px-2 py-2">
              <div className="flex items-center gap-2.5">
                <div className="avatar avatar-sm shrink-0">{ini}</div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold leading-tight">
                    {user?.name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {appRoleLabel(user?.role)}
                  </p>
                </div>
              </div>
              {user?.email ? (
                <p className="mt-2 truncate px-0.5 text-xs text-muted-foreground">
                  {user.email}
                </p>
              ) : null}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings/profile">
                <User />
                Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={handleLogout}>
              <LogOut />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
