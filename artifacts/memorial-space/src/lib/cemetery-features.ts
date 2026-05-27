/**
 * UI labels and metadata for cemetery types and platform feature flags.
 * Keep in sync with `lib/db/src/schema/organizations.ts`.
 */
import {
  Church,
  Archive,
  Columns3,
  Cat,
  Trees,
  Building2,
  MapPinned,
  HeartHandshake,
  CalendarDays,
  ClipboardList,
  Wrench,
  Receipt,
  BookOpen,
  Newspaper,
  QrCode,
  Store,
  Globe2,
  Network,
  Lock,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type CemeteryType =
  | "church"
  | "private"
  | "pet"
  | "municipality"
  | "columbarium"
  | "mausoleum";

export type PlatformFeature =
  | "plotMap"
  | "burials"
  | "bookings"
  | "workOrders"
  | "maintenance"
  | "expenses"
  | "accounting"
  | "memorials"
  | "obituaries"
  | "qrCodes"
  | "marketplace"
  | "publicSite"
  | "columbarium"
  | "mausoleum"
  | "petCemetery"
  | "multiSite"
  | "sso";

export interface CemeteryTypeMeta {
  value: CemeteryType;
  label: string;
  blurb: string;
  icon: LucideIcon;
  /** Tailwind colour token used for the icon tint when selected. */
  accent: string;
}

export const CEMETERY_TYPE_META: CemeteryTypeMeta[] = [
  {
    value: "church",
    label: "Church Cemetery",
    blurb: "Parish-run grounds, often with a columbarium on site.",
    icon: Church,
    accent: "text-violet-300",
  },
  {
    value: "columbarium",
    label: "Columbarium",
    blurb: "Niches and urn vaults — indoor or outdoor.",
    icon: Columns3,
    accent: "text-amber-300",
  },
  {
    value: "mausoleum",
    label: "Mausoleum",
    blurb: "Above-ground crypts and family chambers.",
    icon: Archive,
    accent: "text-rose-300",
  },
  {
    value: "pet",
    label: "Pet Cemetery",
    blurb: "Dedicated final resting places for companion animals.",
    icon: Cat,
    accent: "text-emerald-300",
  },
  {
    value: "private",
    label: "Private Cemetery",
    blurb: "Family-owned or commercial private grounds.",
    icon: Trees,
    accent: "text-sky-300",
  },
  {
    value: "municipality",
    label: "Municipal Cemetery",
    blurb: "City, town, or county-run public cemetery.",
    icon: Building2,
    accent: "text-cyan-300",
  },
];

export interface FeatureMeta {
  key: PlatformFeature;
  label: string;
  description: string;
  icon: LucideIcon;
  /** Group label for organising the feature picker. */
  group: "Operations" | "Customer-facing" | "Specialty" | "Enterprise";
}

export const FEATURE_META: FeatureMeta[] = [
  { key: "plotMap", label: "Plot Map", description: "Interactive map of plots, sections, and availability.", icon: MapPinned, group: "Operations" },
  { key: "burials", label: "Burial Records", description: "Burial registry, certificates, and family links.", icon: HeartHandshake, group: "Operations" },
  { key: "bookings", label: "Bookings", description: "Service scheduling, deposits, and reminders.", icon: CalendarDays, group: "Operations" },
  { key: "workOrders", label: "Work Orders", description: "Crew tasks, status, and proof-of-completion photos.", icon: ClipboardList, group: "Operations" },
  { key: "maintenance", label: "Maintenance", description: "Recurring grounds, equipment, and grave care schedules.", icon: Wrench, group: "Operations" },
  { key: "expenses", label: "Expenses", description: "Approvals, receipts, vendor reimbursements.", icon: Receipt, group: "Operations" },
  { key: "accounting", label: "Accounting", description: "Customer invoices, payments, and tax rates.", icon: Wallet, group: "Operations" },
  { key: "memorials", label: "Memorial Pages", description: "Online memorial pages families can co-curate.", icon: BookOpen, group: "Customer-facing" },
  { key: "obituaries", label: "Obituaries", description: "Publish obituaries to the public site.", icon: Newspaper, group: "Customer-facing" },
  { key: "qrCodes", label: "QR Codes", description: "Headstone QR codes that open the memorial page.", icon: QrCode, group: "Customer-facing" },
  { key: "marketplace", label: "Marketplace", description: "Vendor services families can order online.", icon: Store, group: "Customer-facing" },
  { key: "publicSite", label: "Public Site", description: "Branded /c/your-slug website families can browse.", icon: Globe2, group: "Customer-facing" },
  { key: "columbarium", label: "Columbarium", description: "Niche inventory and urn placement workflow.", icon: Columns3, group: "Specialty" },
  { key: "mausoleum", label: "Mausoleum", description: "Crypt and chamber inventory and bookings.", icon: Archive, group: "Specialty" },
  { key: "petCemetery", label: "Pet Cemetery", description: "Pet-specific records and memorial flow.", icon: Cat, group: "Specialty" },
  { key: "multiSite", label: "Multi-cemetery Group", description: "Manage multiple sites under one account.", icon: Network, group: "Enterprise" },
  { key: "sso", label: "Single Sign-On", description: "SAML / OIDC for staff accounts.", icon: Lock, group: "Enterprise" },
];

export const FEATURE_GROUPS: Array<FeatureMeta["group"]> = [
  "Operations",
  "Customer-facing",
  "Specialty",
  "Enterprise",
];

export const DEFAULT_FEATURES_FOR_TYPE: Record<CemeteryType, PlatformFeature[]> = {
  church: ["plotMap", "burials", "bookings", "workOrders", "maintenance", "memorials", "obituaries", "qrCodes", "publicSite"],
  private: ["plotMap", "burials", "bookings", "workOrders", "maintenance", "expenses", "accounting", "memorials", "obituaries", "qrCodes", "marketplace", "publicSite"],
  pet: ["plotMap", "burials", "bookings", "memorials", "qrCodes", "publicSite", "petCemetery"],
  municipality: ["plotMap", "burials", "bookings", "workOrders", "maintenance", "expenses", "accounting", "memorials", "obituaries", "qrCodes", "publicSite", "multiSite"],
  columbarium: ["bookings", "memorials", "qrCodes", "publicSite", "columbarium"],
  mausoleum: ["bookings", "memorials", "qrCodes", "publicSite", "mausoleum"],
};

export function defaultFeaturesFor(types: CemeteryType[]): Partial<Record<PlatformFeature, boolean>> {
  const out: Partial<Record<PlatformFeature, boolean>> = {};
  for (const t of types) for (const f of DEFAULT_FEATURES_FOR_TYPE[t]) out[f] = true;
  return out;
}
