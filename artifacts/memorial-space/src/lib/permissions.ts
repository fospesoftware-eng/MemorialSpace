export const TEAM_ROLES = ["owner", "admin", "manager", "staff", "viewer"] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];

export const TEAM_STATUSES = ["active", "invited", "suspended"] as const;
export type TeamStatus = (typeof TEAM_STATUSES)[number];

export type Capability =
  | "cemetery.view"
  | "cemetery.edit"
  | "burials.view"
  | "burials.edit"
  | "bookings.manage"
  | "workOrders.manage"
  | "memorials.manage"
  | "obituaries.manage"
  | "qrCodes.manage"
  | "marketplace.view"
  | "marketplace.edit"
  | "publicSite.edit"
  | "accounting.view"
  | "accounting.edit"
  | "team.view"
  | "team.invite"
  | "team.manageRoles"
  | "team.remove"
  | "settings.edit"
  | "billing.manage"
  | "ownership.transfer";

export const ALL_CAPABILITIES: Capability[] = [
  "cemetery.view",
  "cemetery.edit",
  "burials.view",
  "burials.edit",
  "bookings.manage",
  "workOrders.manage",
  "memorials.manage",
  "obituaries.manage",
  "qrCodes.manage",
  "marketplace.view",
  "marketplace.edit",
  "publicSite.edit",
  "accounting.view",
  "accounting.edit",
  "team.view",
  "team.invite",
  "team.manageRoles",
  "team.remove",
  "settings.edit",
  "billing.manage",
  "ownership.transfer",
];

export const CAPABILITY_LABELS: Record<Capability, string> = {
  "cemetery.view": "View map & plots",
  "cemetery.edit": "Edit map & plot configuration",
  "burials.view": "View burial records",
  "burials.edit": "Add & edit burial records",
  "bookings.manage": "Manage bookings",
  "workOrders.manage": "Manage work orders",
  "memorials.manage": "Manage memorial pages",
  "obituaries.manage": "Manage obituaries",
  "qrCodes.manage": "Generate & manage QR codes",
  "marketplace.view": "View marketplace catalogue & orders",
  "marketplace.edit": "Edit marketplace products & process orders",
  "publicSite.edit": "Edit the public cemetery website",
  "accounting.view": "View invoices & payments",
  "accounting.edit": "Issue invoices & record payments",
  "team.view": "View team members",
  "team.invite": "Invite new team members",
  "team.manageRoles": "Change team member roles",
  "team.remove": "Remove team members",
  "settings.edit": "Edit cemetery details & settings",
  "billing.manage": "Manage subscription & billing",
  "ownership.transfer": "Transfer cemetery ownership",
};

const VIEWER: Capability[] = [
  "cemetery.view",
  "burials.view",
  "marketplace.view",
  "accounting.view",
  "team.view",
];

const STAFF: Capability[] = [
  ...VIEWER,
  "burials.edit",
  "bookings.manage",
  "workOrders.manage",
  "memorials.manage",
  "obituaries.manage",
  "qrCodes.manage",
];

const MANAGER: Capability[] = [
  ...STAFF,
  "cemetery.edit",
  "marketplace.edit",
  "publicSite.edit",
  "accounting.edit",
];

const ADMIN: Capability[] = [
  ...MANAGER,
  "team.invite",
  "team.manageRoles",
  "team.remove",
  "settings.edit",
];

const OWNER: Capability[] = [...ADMIN, "billing.manage", "ownership.transfer"];

export const ROLE_CAPABILITIES: Record<TeamRole, Capability[]> = {
  viewer: VIEWER,
  staff: STAFF,
  manager: MANAGER,
  admin: ADMIN,
  owner: OWNER,
};

export const ROLE_LABELS: Record<TeamRole, string> = {
  owner: "Owner",
  admin: "Admin",
  manager: "Manager",
  staff: "Staff",
  viewer: "Viewer",
};

export const ROLE_DESCRIPTIONS: Record<TeamRole, string> = {
  owner: "Full control. Manages billing, transfers ownership, and can do everything an Admin can.",
  admin: "Full operational control plus team management and cemetery settings. Cannot manage billing.",
  manager: "Day-to-day operations and finance: edits the map, marketplace, public site, and invoices.",
  staff: "Field operations: burials, bookings, work orders, memorials, obituaries, QR codes.",
  viewer: "Read-only access. Cannot make any changes.",
};

export const ROLE_BADGE_COLOR: Record<TeamRole, string> = {
  owner: "bg-amber-500/15 text-amber-600 border-amber-500/30 dark:text-amber-400",
  admin: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30 dark:text-emerald-400",
  manager: "bg-sky-500/15 text-sky-600 border-sky-500/30 dark:text-sky-400",
  staff: "bg-violet-500/15 text-violet-600 border-violet-500/30 dark:text-violet-400",
  viewer: "bg-slate-500/15 text-slate-600 border-slate-500/30 dark:text-slate-400",
};

export const STATUS_LABELS: Record<TeamStatus, string> = {
  active: "Active",
  invited: "Invited",
  suspended: "Suspended",
};

export const STATUS_BADGE_COLOR: Record<TeamStatus, string> = {
  active: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30 dark:text-emerald-400",
  invited: "bg-amber-500/15 text-amber-600 border-amber-500/30 dark:text-amber-400",
  suspended: "bg-rose-500/15 text-rose-600 border-rose-500/30 dark:text-rose-400",
};

export function roleHasCapability(role: TeamRole, cap: Capability): boolean {
  return ROLE_CAPABILITIES[role].includes(cap);
}
