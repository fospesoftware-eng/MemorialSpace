import logoDark from "@assets/ChatGPT_Image_May_14,_2026,_02_00_07_PM_(1)_(1)_1778747500894.png";
import logoLight from "@assets/memorial_space_logo_soft_whitish_transparent_1779861214860.png";
import { useTheme } from "@/components/theme-provider";

interface LogoProps {
  alt?: string;
  height?: number;
  className?: string;
  forDarkBg?: boolean;
}

export function Logo({ alt = "MemorialSpace", height = 36, className, forDarkBg }: LogoProps) {
  const { theme } = useTheme();
  const resolvedDark =
    forDarkBg ||
    theme === "dark" ||
    (theme === "system" &&
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  const src = resolvedDark ? logoLight : logoDark;

  return (
    <img
      src={src}
      alt={alt}
      className={`w-auto select-none ${className ?? ""}`}
      style={{ height }}
      draggable={false}
    />
  );
}
