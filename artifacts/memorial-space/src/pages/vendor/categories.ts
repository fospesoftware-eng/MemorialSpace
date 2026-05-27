/**
 * Five-category funeral lifecycle taxonomy used by the vendor and public
 * marketplace. Mirrors `FUNERAL_CATEGORIES` in `lib/db/src/schema/vendors.ts`
 * — keep in sync.
 */
import {
  Flower2,
  Sparkles,
  Wrench,
  Hammer,
  CalendarHeart,
  type LucideIcon,
} from "lucide-react";

export type FuneralCategory =
  | "funeral-services"
  | "religious"
  | "maintenance"
  | "headstone"
  | "remembrance";

export interface CategoryMeta {
  key: FuneralCategory;
  label: string;
  blurb: string;
  icon: LucideIcon;
  accent: string;
}

export const FUNERAL_CATEGORIES: CategoryMeta[] = [
  {
    key: "funeral-services",
    label: "Funeral services",
    blurb: "Full-service funeral planning, transport, and ceremony coordination.",
    icon: Flower2,
    accent: "from-rose-500/20 to-rose-500/5 text-rose-300",
  },
  {
    key: "religious",
    label: "Priest & religious",
    blurb: "Officiants, prayer services, and faith-led ceremonies.",
    icon: Sparkles,
    accent: "from-amber-500/20 to-amber-500/5 text-amber-300",
  },
  {
    key: "maintenance",
    label: "Grave maintenance",
    blurb: "Year-round grave care subscriptions and seasonal upkeep.",
    icon: Wrench,
    accent: "from-emerald-500/20 to-emerald-500/5 text-emerald-300",
  },
  {
    key: "headstone",
    label: "Headstones & monuments",
    blurb: "Custom headstone design, carving, and on-site installation.",
    icon: Hammer,
    accent: "from-sky-500/20 to-sky-500/5 text-sky-300",
  },
  {
    key: "remembrance",
    label: "Annual remembrance",
    blurb: "Anniversary flowers, tribute candles, and yearly memorial packages.",
    icon: CalendarHeart,
    accent: "from-violet-500/20 to-violet-500/5 text-violet-300",
  },
];

export const CATEGORY_BY_KEY: Record<FuneralCategory, CategoryMeta> =
  FUNERAL_CATEGORIES.reduce((acc, c) => {
    acc[c.key] = c;
    return acc;
  }, {} as Record<FuneralCategory, CategoryMeta>);

export function categoryLabel(key: string | null | undefined): string {
  if (!key) return "Uncategorised";
  const hit = CATEGORY_BY_KEY[key as FuneralCategory];
  return hit ? hit.label : key;
}
