/** Shared helpers for the Super Admin module — money, formatting, badges. */

export function formatCents(cents: number, currency = "USD"): string {
  const dollars = cents / 100;
  return dollars.toLocaleString(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: dollars % 1 === 0 ? 0 : 2,
  });
}

export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function relativeTime(d: string | Date | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "";
  const diff = Date.now() - date.getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

export const subStatusClass: Record<string, string> = {
  trialing: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  active: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  past_due: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  cancelled: "bg-slate-500/15 text-slate-300 border-slate-500/30",
  suspended: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

export const orgStatusClass: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  trial: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  suspended: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  cancelled: "bg-slate-500/15 text-slate-400 border-slate-500/30",
};

export const invoiceStatusClass: Record<string, string> = {
  draft: "bg-slate-500/15 text-slate-300 border-slate-500/30",
  open: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  paid: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  void: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
  uncollectible: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

export const ADMIN_API_BASE = "/api/admin";
