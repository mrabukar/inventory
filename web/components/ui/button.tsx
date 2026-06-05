import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "outline" | "ghost" | "danger";
type Size    = "sm" | "md" | "lg";

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  Icon?: LucideIcon;
  iconName?: string;
  block?: boolean;
}

const sizeMap: Record<Size, string> = {
  sm: "btn-sm",
  md: "",
  lg: "btn-lg",
};

export function Button({
  variant = "primary",
  size = "md",
  Icon,
  block,
  children,
  className,
  ...rest
}: Props) {
  return (
    <button
      className={cn("btn", `btn-${variant}`, sizeMap[size], block && "btn-block", className)}
      {...rest}
    >
      {Icon && <Icon size={16} />}
      {children}
    </button>
  );
}
