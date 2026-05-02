import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Search,
  Shield,
  ShieldAlert,
  Users as UsersIcon,
  MoreVertical,
  UserCog,
  UserMinus,
  Send,
  KeyRound,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  ROLE_BADGE_COLOR,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  STATUS_BADGE_COLOR,
  STATUS_LABELS,
  TEAM_ROLES,
  TEAM_STATUSES,
  type TeamRole,
  type TeamStatus,
} from "@/lib/permissions";

const ORG_ID = 1;

type TeamMember = {
  id: number;
  organizationId: number;
  name: string;
  email: string;
  role: TeamRole;
  status: TeamStatus;
  jobTitle: string | null;
  phone: string | null;
  avatarUrl: string | null;
  lastActiveAt: string | null;
  invitedAt: string | null;
  createdAt: string;
};

type Summary = {
  total: number;
  byRole: Record<string, number>;
  byStatus: Record<string, number>;
};

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const text = await res.text();
    let msg = text;
    try {
      msg = JSON.parse(text).error ?? text;
    } catch {}
    throw new Error(msg || `${res.status}`);
  }
  if (res.status === 204) return undefined as unknown as T;
  return res.json();
}

const initials = (name: string) =>
  name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase();

const relativeTime = (iso: string | null) => {
  if (!iso) return "Never";
  const ms = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return "Just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
};

export default function TeamPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<TeamRole | "all">("all");
  const [statusFilter, setStatusFilter] = useState<TeamStatus | "all">("all");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editing, setEditing] = useState<TeamMember | null>(null);

  const membersQuery = useQuery({
    queryKey: ["team-members", ORG_ID],
    queryFn: () => api<TeamMember[]>(`/api/users?organizationId=${ORG_ID}`),
  });
  const summaryQuery = useQuery({
    queryKey: ["team-summary", ORG_ID],
    queryFn: () => api<Summary>(`/api/team-summary?organizationId=${ORG_ID}`),
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["team-members", ORG_ID] });
    qc.invalidateQueries({ queryKey: ["team-summary", ORG_ID] });
  };

  const inviteMutation = useMutation({
    mutationFn: (data: {
      name: string;
      email: string;
      role: TeamRole;
      jobTitle?: string;
      phone?: string;
    }) =>
      api<TeamMember>(`/api/users`, {
        method: "POST",
        body: JSON.stringify({
          organizationId: ORG_ID,
          status: "invited",
          ...data,
        }),
      }),
    onSuccess: () => {
      invalidateAll();
      setInviteOpen(false);
      toast({ title: "Invite sent", description: "The team member will appear with an Invited badge." });
    },
    onError: (e) =>
      toast({ title: "Could not invite", description: String((e as Error).message), variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: Partial<TeamMember> }) =>
      api<TeamMember>(`/api/users/${id}?organizationId=${ORG_ID}`, {
        method: "PUT",
        body: JSON.stringify(patch),
      }),
    onSuccess: () => {
      invalidateAll();
      setEditing(null);
    },
    onError: (e) =>
      toast({ title: "Update failed", description: String((e as Error).message), variant: "destructive" }),
  });

  const removeMutation = useMutation({
    mutationFn: (id: number) =>
      api<void>(`/api/users/${id}?organizationId=${ORG_ID}`, { method: "DELETE" }),
    onSuccess: () => {
      invalidateAll();
      toast({ title: "Member removed" });
    },
    onError: (e) =>
      toast({ title: "Could not remove", description: String((e as Error).message), variant: "destructive" }),
  });

  const resendMutation = useMutation({
    mutationFn: (id: number) =>
      api<TeamMember>(`/api/users/${id}/resend-invite?organizationId=${ORG_ID}`, { method: "POST" }),
    onSuccess: () => {
      invalidateAll();
      toast({ title: "Invite resent", description: "Invitation timestamp refreshed." });
    },
  });

  const visible = useMemo(() => {
    const all = membersQuery.data ?? [];
    const q = search.trim().toLowerCase();
    return all.filter((m) => {
      if (roleFilter !== "all" && m.role !== roleFilter) return false;
      if (statusFilter !== "all" && m.status !== statusFilter) return false;
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        (m.jobTitle ?? "").toLowerCase().includes(q)
      );
    });
  }, [membersQuery.data, search, roleFilter, statusFilter]);

  const summary = summaryQuery.data;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Team & Access</h1>
          <p className="text-muted-foreground mt-1">
            Invite colleagues and control what each person can see and do in your dashboard.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" data-testid="link-roles-page">
            <Link href="/team/roles">
              <Shield className="h-4 w-4 mr-2" />
              Roles & permissions
            </Link>
          </Button>
          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-invite-member">
                <Plus className="h-4 w-4 mr-2" />
                Invite member
              </Button>
            </DialogTrigger>
            <InviteDialog onSubmit={(data) => inviteMutation.mutate(data)} pending={inviteMutation.isPending} />
          </Dialog>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard
          icon={<UsersIcon className="h-4 w-4" />}
          label="Total members"
          value={summary?.total ?? 0}
          tone="primary"
        />
        <SummaryCard
          icon={<Shield className="h-4 w-4" />}
          label="Owners & admins"
          value={(summary?.byRole.owner ?? 0) + (summary?.byRole.admin ?? 0)}
          tone="emerald"
        />
        <SummaryCard
          icon={<Send className="h-4 w-4" />}
          label="Pending invites"
          value={summary?.byStatus.invited ?? 0}
          tone="amber"
        />
        <SummaryCard
          icon={<ShieldAlert className="h-4 w-4" />}
          label="Suspended"
          value={summary?.byStatus.suspended ?? 0}
          tone="rose"
        />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or job title…"
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                data-testid="input-team-search"
              />
            </div>
            <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as TeamRole | "all")}>
              <SelectTrigger className="md:w-44" data-testid="select-role-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                {TEAM_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as TeamStatus | "all")}>
              <SelectTrigger className="md:w-44" data-testid="select-status-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {TEAM_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Member list */}
      {membersQuery.isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="h-20 animate-pulse bg-muted/50" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <UsersIcon className="h-10 w-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No team members match your filters.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {visible.map((m) => (
            <MemberRow
              key={m.id}
              member={m}
              onEdit={() => setEditing(m)}
              onRemove={() => removeMutation.mutate(m.id)}
              onResend={() => resendMutation.mutate(m.id)}
              onChangeRole={(role) => updateMutation.mutate({ id: m.id, patch: { role } })}
              onChangeStatus={(status) => updateMutation.mutate({ id: m.id, patch: { status } })}
              removePending={removeMutation.isPending}
            />
          ))}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={editing != null} onOpenChange={(open) => !open && setEditing(null)}>
        {editing && (
          <EditDialog
            member={editing}
            onSubmit={(patch) => updateMutation.mutate({ id: editing.id, patch })}
            pending={updateMutation.isPending}
          />
        )}
      </Dialog>
    </div>
  );
}

/* ─────────────────────────  Subcomponents  ───────────────────────── */

function SummaryCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: "primary" | "emerald" | "amber" | "rose";
}) {
  const toneClass = {
    primary: "bg-primary/10 text-primary",
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  }[tone];
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">
              {label}
            </p>
            <p className="text-2xl font-bold mt-1">{value}</p>
          </div>
          <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${toneClass}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MemberRow({
  member,
  onEdit,
  onRemove,
  onResend,
  onChangeRole,
  onChangeStatus,
  removePending,
}: {
  member: TeamMember;
  onEdit: () => void;
  onRemove: () => void;
  onResend: () => void;
  onChangeRole: (r: TeamRole) => void;
  onChangeStatus: (s: TeamStatus) => void;
  removePending: boolean;
}) {
  const isOwner = member.role === "owner";
  return (
    <Card data-testid={`row-member-${member.id}`} className="hover:border-primary/30 transition-colors">
      <CardContent className="py-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Avatar className="h-10 w-10 border border-primary/20">
              <AvatarImage src={member.avatarUrl ?? undefined} alt={member.name} />
              <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                {initials(member.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-sm truncate">{member.name}</p>
                {member.jobTitle && (
                  <span className="text-xs text-muted-foreground">· {member.jobTitle}</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate">{member.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={`${ROLE_BADGE_COLOR[member.role]} text-xs font-medium`}>
              {ROLE_LABELS[member.role]}
            </Badge>
            <Badge variant="outline" className={`${STATUS_BADGE_COLOR[member.status]} text-xs font-medium`}>
              {STATUS_LABELS[member.status]}
            </Badge>
            <span className="text-xs text-muted-foreground hidden md:inline">
              Last active {relativeTime(member.lastActiveAt)}
            </span>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  data-testid={`menu-member-${member.id}`}
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Member actions</DropdownMenuLabel>
                <DropdownMenuItem onClick={onEdit}>
                  <UserCog className="h-4 w-4 mr-2" />
                  Edit details
                </DropdownMenuItem>
                {member.status === "invited" && (
                  <DropdownMenuItem onClick={onResend}>
                    <Send className="h-4 w-4 mr-2" />
                    Resend invite
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  Change role
                </DropdownMenuLabel>
                {TEAM_ROLES.map((r) => (
                  <DropdownMenuItem
                    key={r}
                    onClick={() => onChangeRole(r)}
                    disabled={r === member.role}
                  >
                    <KeyRound className="h-4 w-4 mr-2 opacity-50" />
                    {ROLE_LABELS[r]}
                    {r === member.role && (
                      <span className="ml-auto text-xs text-muted-foreground">current</span>
                    )}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                {member.status !== "suspended" ? (
                  <DropdownMenuItem
                    onClick={() => onChangeStatus("suspended")}
                    disabled={isOwner}
                    className="text-amber-600 focus:text-amber-600"
                  >
                    <ShieldAlert className="h-4 w-4 mr-2" />
                    Suspend access
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => onChangeStatus("active")}>
                    <Shield className="h-4 w-4 mr-2" />
                    Reactivate
                  </DropdownMenuItem>
                )}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <DropdownMenuItem
                      onSelect={(e) => e.preventDefault()}
                      className="text-destructive focus:text-destructive"
                    >
                      <UserMinus className="h-4 w-4 mr-2" />
                      Remove from team
                    </DropdownMenuItem>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                        Remove {member.name}?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        They will immediately lose access to your dashboard. This cannot be undone — you'll need to invite them again to restore access.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={onRemove}
                        disabled={removePending}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {removePending ? "Removing…" : "Remove"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function InviteDialog({
  onSubmit,
  pending,
}: {
  onSubmit: (data: { name: string; email: string; role: TeamRole; jobTitle?: string; phone?: string }) => void;
  pending: boolean;
}) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "staff" as TeamRole,
    jobTitle: "",
    phone: "",
  });
  const valid = form.name.trim() && form.email.trim().includes("@");
  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Invite a team member</DialogTitle>
        <DialogDescription>
          They'll appear with an "Invited" badge. Email-based sign-in arrives in a future release.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-2">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Full name</Label>
            <Input
              className="mt-1"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Maria López"
              data-testid="input-invite-name"
            />
          </div>
          <div>
            <Label>Job title</Label>
            <Input
              className="mt-1"
              value={form.jobTitle}
              onChange={(e) => setForm((f) => ({ ...f, jobTitle: e.target.value }))}
              placeholder="Burials coordinator"
              data-testid="input-invite-job"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Email</Label>
            <Input
              type="email"
              className="mt-1"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="maria@cemetery.com"
              data-testid="input-invite-email"
            />
          </div>
          <div>
            <Label>Phone (optional)</Label>
            <Input
              className="mt-1"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="+1-555-0100"
              data-testid="input-invite-phone"
            />
          </div>
        </div>
        <div>
          <Label>Role</Label>
          <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v as TeamRole }))}>
            <SelectTrigger className="mt-1" data-testid="select-invite-role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TEAM_ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {ROLE_LABELS[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
            {ROLE_DESCRIPTIONS[form.role]}
          </p>
        </div>
      </div>
      <DialogFooter>
        <Button
          onClick={() =>
            onSubmit({
              name: form.name.trim(),
              email: form.email.trim().toLowerCase(),
              role: form.role,
              jobTitle: form.jobTitle.trim() || undefined,
              phone: form.phone.trim() || undefined,
            })
          }
          disabled={!valid || pending}
          data-testid="button-send-invite"
        >
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending…
            </>
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" /> Send invite
            </>
          )}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function EditDialog({
  member,
  onSubmit,
  pending,
}: {
  member: TeamMember;
  onSubmit: (patch: Partial<TeamMember>) => void;
  pending: boolean;
}) {
  const [form, setForm] = useState({
    name: member.name,
    email: member.email,
    role: member.role,
    jobTitle: member.jobTitle ?? "",
    phone: member.phone ?? "",
  });
  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Edit team member</DialogTitle>
        <DialogDescription>
          Update {member.name}'s contact details and access level.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-2">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Full name</Label>
            <Input
              className="mt-1"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              data-testid="input-edit-name"
            />
          </div>
          <div>
            <Label>Job title</Label>
            <Input
              className="mt-1"
              value={form.jobTitle}
              onChange={(e) => setForm((f) => ({ ...f, jobTitle: e.target.value }))}
              data-testid="input-edit-job"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Email</Label>
            <Input
              type="email"
              className="mt-1"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              data-testid="input-edit-email"
            />
          </div>
          <div>
            <Label>Phone</Label>
            <Input
              className="mt-1"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              data-testid="input-edit-phone"
            />
          </div>
        </div>
        <div>
          <Label>Role</Label>
          <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v as TeamRole }))}>
            <SelectTrigger className="mt-1" data-testid="select-edit-role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TEAM_ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {ROLE_LABELS[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
            {ROLE_DESCRIPTIONS[form.role]}
          </p>
        </div>
      </div>
      <DialogFooter>
        <Button
          onClick={() =>
            onSubmit({
              name: form.name.trim(),
              email: form.email.trim().toLowerCase(),
              role: form.role,
              jobTitle: (form.jobTitle.trim() || null) as string | null,
              phone: (form.phone.trim() || null) as string | null,
            })
          }
          disabled={pending || !form.name.trim() || !form.email.trim().includes("@")}
          data-testid="button-save-edit"
        >
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving…
            </>
          ) : (
            "Save changes"
          )}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
