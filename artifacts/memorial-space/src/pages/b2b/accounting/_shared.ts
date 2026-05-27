export const ORG_ID = 1;

export function formatMoney(value: number | null | undefined): string {
  const n = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function invoiceStatusBadgeClass(status: string): string {
  switch (status) {
    case "draft":
      return "bg-muted text-muted-foreground";
    case "issued":
      return "bg-[#d4a843]/20 text-[#d4a843]";
    case "partially_paid":
      return "bg-[#3a86ff]/20 text-[#3a86ff]";
    case "paid":
      return "bg-primary/20 text-primary";
    case "voided":
      return "bg-destructive/20 text-destructive";
    default:
      return "bg-secondary text-secondary-foreground";
  }
}

export function invoiceStatusLabel(status: string): string {
  return status.replace("_", " ");
}
