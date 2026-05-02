import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Users as UsersIcon } from "lucide-react";
import { useAdminUserSearch } from "./api";
import { formatDateTime, relativeTime } from "./_shared";

const ROLE_TONE: Record<string, string> = {
  owner: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  admin: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  manager: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  staff: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  viewer: "bg-slate-500/15 text-slate-300 border-slate-500/30",
};
const STATUS_TONE: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  invited: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  suspended: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

export default function AdminUsers() {
  const [q, setQ] = useState("");
  const { data, isLoading } = useAdminUserSearch(q.trim());

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-[#d4a843] mb-1">Super Admin</p>
        <h1 className="text-3xl font-bold tracking-tight">All Users</h1>
        <p className="text-muted-foreground mt-1">
          Cross-organization user search — find an account quickly across all tenants.
        </p>
      </div>

      <Card className="border-border/60">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              data-testid="admin-user-search"
              placeholder="Search by name or email"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UsersIcon className="h-5 w-5 text-[#d4a843]" />
            {data?.length ?? 0} user{(data?.length ?? 0) === 1 ? "" : "s"}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-border/60 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3 font-medium">User</th>
                <th className="text-left px-4 py-3 font-medium">Organization</th>
                <th className="text-left px-4 py-3 font-medium">Role</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Last active</th>
                <th className="text-left px-4 py-3 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Loading…</td>
                </tr>
              )}
              {!isLoading && (data ?? []).length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No users match.</td>
                </tr>
              )}
              {(data ?? []).map(({ user, org }) => (
                <tr key={user.id} className="border-b border-border/30">
                  <td className="px-4 py-3">
                    <div className="font-medium">{user.name ?? user.email}</div>
                    <div className="text-xs text-muted-foreground">{user.email}{user.jobTitle ? ` · ${user.jobTitle}` : ""}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm">{org?.name ?? `Org #${user.organizationId}`}</div>
                    <div className="text-xs text-muted-foreground">{org ? `/${org.slug}` : ""}</div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={ROLE_TONE[user.role] ?? ""}>{user.role}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={STATUS_TONE[user.status] ?? ""}>{user.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{relativeTime(user.lastActiveAt) || "—"}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{formatDateTime(user.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
