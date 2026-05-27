import logoAsset from "@assets/ChatGPT_Image_May_14,_2026,_02_00_07_PM_(1)_(1)_1778747500894.png";

interface LogoProps {
  alt?: string;
  height?: number;
  className?: string;
}

export function Logo({ alt = "MemorialSpace", height = 36, className }: LogoProps) {
  return (
    <img
      src={logoAsset}
      alt={alt}
      className={`w-auto select-none ${className ?? ""}`}
      style={{ height }}
      draggable={false}
    />
  );
}
