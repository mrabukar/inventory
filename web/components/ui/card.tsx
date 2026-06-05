import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface Props {
  title?: string;
  titleIcon?: LucideIcon;
  link?: string;
  onLink?: () => void;
  children: React.ReactNode;
  className?: string;
  bodyClass?: string;
  pad?: boolean;
}

export function Card({ title, titleIcon: TitleIcon, link, onLink, children, className, bodyClass, pad }: Props) {
  return (
    <div className={cn("card", className)}>
      {title && (
        <div className="card-head">
          <h3>
            {TitleIcon && <TitleIcon size={16} style={{ color: "var(--status-amber)" }} />}
            {title}
          </h3>
          {link && (
            <button className="card-link" onClick={onLink}>{link}</button>
          )}
        </div>
      )}
      <div className={bodyClass ?? (pad ? "card-pad" : "")}>{children}</div>
    </div>
  );
}
