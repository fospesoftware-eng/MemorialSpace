import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  History,
  Search,
  Shield,
  CreditCard,
  Building2,
  Receipt,
  RefreshCw,
} from "lucide-react";
import { useAuditLog } from "./api";
import { formatDateTime, relativeTime } from "./_shared";

const ACTION_FILTERS = [
  { value: "all", label: "All actions" },
  { value: "organization.", label: "Organization actions" },
  { value: "subscription.", label: "Subscription actions" },
  { value: "invoice.", label: "Invoice actions" },
  { value: "plan.", label: "Plan actions" },
];

function actionIcon(action: string) {
  if (action.startsWith("organization")) return Building2;
  if (action.startsWith("subscription")) return RefreshCw;
  if (action.startsWith("invoice")) return Receipt;
  if (action.startsWith("plan")) return CreditCard;
  return Shield;
}

function actionTone(action: string): string {
  if (action.includes("suspend") || action.includes("cancel") || action.includes("void"))
    return "bg-rose-500/10 text-rose-400";
  if (action.includes("paid") || action.includes("reactivat") || action.includes("issued"))
    return "bg-emerald-500/10 text-emerald-400";
  if (action.includes("created") || action.includes("updated"))
    return "bg-[#d4a843]/10 text-[#d4a843]";
  return "bg-muted text-muted-foreground";
}

export default function AdminSupport() {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const { data, isLoading } = useAuditLog({
    action: filter === "all" ? undefined : filter,
    limit: 200,
  });

  const filtered = (data ?? []).filter((row) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      (row.summary ?? "").toLowerCase().includes(s) ||
      (row.actorEmail ?? "").toLowerCase().includes(s) ||
      row.action.toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-[#d4a843] mb-1">Super Admin</p>
        <h1 className="text-3xl font-bold tracking-tight">Audit Log</h1>
        <p className="text-muted-foreground mt-1">
          Every Super Admin action is recorded here — perfect for support investigations,
          compliance, and recovering from accidental changes.
        </p>
      </div>

      <Card className="border-border/60">
        <CardContent className="p-4 flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              data-testid="audit-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by summary, actor, or action key"
              className="pl-9"
            />
          </div>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-56" data-testid="audit-filter"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ACTION_FILTERS.map((f) => (
                <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-[#d4a843]" />
            {filtered.length} event{filtered.length === 1 ? "" : "s"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!isLoading && filtered.length === 0 && (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No audit events match.
            </p>
          )}
          {filtered.map((row) => {
            const Icon = actionIcon(row.action);
            return (
              <div
                key={row.id}
                className="flex items-start gap-3 p-3 rounded-lg border border-border/40 hover:border-border transition-colors"
                data-testid={`audit-row-${row.id}`}
              >
                <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${actionTone(row.action)}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium">
                      {row.summary ?? row.action}
                    </p>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {relativeTime(row.createdAt)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                    <Badge variant="outline" className="text-[10px] font-mono">
                      {row.action}
                    </Badge>
                    {row.actorEmail && <span>by {row.actorEmail}</span>}
                    {row.targetType && row.targetId && (
                      <span>· {row.targetType} #{row.targetId}</span>
                    )}
                    <span>· {formatDateTime(row.createdAt)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
