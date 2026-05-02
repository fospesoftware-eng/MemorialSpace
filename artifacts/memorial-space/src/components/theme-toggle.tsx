import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

const options = [
  { value: "light", icon: Sun, label: "Light" },
  { value: "system", icon: Monitor, label: "System" },
  { value: "dark", icon: Moon, label: "Dark" },
] as const;

export interface ThemeToggleProps {
  variant?: "sidebar" | "default";
  className?: string;
}

export function ThemeToggle({ variant = "default", className }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const isSidebar = variant === "sidebar";

  return (
    <div
      role="radiogroup"
      aria-label="Select theme"
      data-testid="theme-toggle"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md p-0.5",
        isSidebar
          ? "bg-sidebar-accent/40 border border-sidebar-border"
          : "bg-muted border border-border",
        className,
      )}
    >
      {options.map(({ value, icon: Icon, label }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            data-testid={`theme-${value}`}
            onClick={() => setTheme(value)}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded transition-all",
              active
                ? isSidebar
                  ? "bg-sidebar text-primary shadow-sm"
                  : "bg-background text-primary shadow-sm"
                : isSidebar
                  ? "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/50",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        );
      })}
    </div>
  );
}
