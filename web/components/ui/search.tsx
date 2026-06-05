import { Search as SearchIcon, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchProps {
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
}

export function Search({ placeholder = "Search…", value, onChange }: SearchProps) {
  return (
    <div className="search">
      <SearchIcon size={16} style={{ color: "var(--fg3)", flexShrink: 0 }} />
      <input
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

interface FilterBtnProps {
  label: string;
  active?: boolean;
  onClick?: () => void;
}

export function FilterBtn({ label, active, onClick }: FilterBtnProps) {
  return (
    <button className={cn("filter-btn", active && "active")} onClick={onClick}>
      {label}
      <ChevronDown size={15} style={{ color: "var(--fg3)" }} />
    </button>
  );
}
