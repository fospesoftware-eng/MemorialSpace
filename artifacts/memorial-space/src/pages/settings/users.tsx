import { useState } from "react";
import { useListUsers, useCreateUser, useDeleteUser, getListUsersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Users, Trash2, ShieldCheck, Eye } from "lucide-react";

const ORG_ID = 1;

const roleIcon = (role: string) => {
  if (role === "admin") return <ShieldCheck className="h-3 w-3" />;
  if (role === "staff") return <Users className="h-3 w-3" />;
  return <Eye className="h-3 w-3" />;
};

const roleVariant = (role: string): "default" | "secondary" | "outline" => {
  if (role === "admin") return "default";
  if (role === "staff") return "secondary";
  return "outline";
};

export default function UsersPage() {
  const queryClient = useQueryClient();
  const { data: users, isLoading } = useListUsers({ organizationId: ORG_ID });
  const createUser = useCreateUser();
  const deleteUser = useDeleteUser();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", role: "viewer" as "admin" | "staff" | "viewer" });

  const handleCreate = () => {
    createUser.mutate(
      { data: { organizationId: ORG_ID, name: form.name, email: form.email, role: form.role } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
          setOpen(false);
          setForm({ name: "", email: "", role: "viewer" });
        },
      }
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Users</h1>
          <p className="text-muted-foreground mt-1">Manage team members and their access roles.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-invite-user"><Plus className="h-4 w-4 mr-2" />Invite User</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Invite Team Member</DialogTitle><DialogDescription>Invite a colleague to collaborate on this organization.</DialogDescription></DialogHeader>
            <div className="space-y-4">
              <div><Label>Full Name</Label><Input className="mt-1" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} data-testid="input-user-name" /></div>
              <div><Label>Email</Label><Input className="mt-1" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} data-testid="input-user-email" /></div>
              <div>
                <Label>Role</Label>
                <select className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as any }))} data-testid="select-role">
                  <option value="admin">Admin - Full access</option>
                  <option value="staff">Staff - Operational access</option>
                  <option value="viewer">Viewer - Read only</option>
                </select>
              </div>
              <Button onClick={handleCreate} disabled={createUser.isPending} className="w-full" data-testid="button-submit-user">
                {createUser.isPending ? "Inviting..." : "Send Invite"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3,4].map(i => <Card key={i} className="h-16 animate-pulse bg-muted" />)}</div>
      ) : (
        <div className="space-y-3">
          {users?.map(user => (
            <Card key={user.id} className="hover:border-primary/30 transition-colors" data-testid={`card-user-${user.id}`}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={user.avatarUrl ?? undefined} alt={user.name} />
                      <AvatarFallback className="bg-primary/10 text-primary text-sm">{user.name.split(" ").map(n => n[0]).join("").slice(0, 2)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-sm">{user.name}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={roleVariant(user.role)} className="flex items-center gap-1">
                      {roleIcon(user.role)}{user.role}
                    </Badge>
                    <Button size="icon" variant="ghost" onClick={() => { deleteUser.mutate({ id: user.id }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() }) }); }} data-testid={`button-delete-user-${user.id}`}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
