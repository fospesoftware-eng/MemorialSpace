import { useState } from "react";
import { useListOrganizations, useCreateOrganization, useDeleteOrganization, getListOrganizationsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Building2, MapPin, Phone, Globe, Trash2 } from "lucide-react";

export default function Organizations() {
  const queryClient = useQueryClient();
  const { data: orgs, isLoading } = useListOrganizations();
  const createOrg = useCreateOrganization();
  const deleteOrg = useDeleteOrganization();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", slug: "", address: "", city: "", country: "", phone: "", email: "", website: "" });

  const handleCreate = () => {
    createOrg.mutate(
      { data: { name: form.name, slug: form.slug, address: form.address, city: form.city, country: form.country, phone: form.phone, email: form.email, website: form.website } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListOrganizationsQueryKey() });
          setOpen(false);
          setForm({ name: "", slug: "", address: "", city: "", country: "", phone: "", email: "", website: "" });
        },
      }
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Organizations</h1>
          <p className="text-muted-foreground mt-1">Manage cemetery organizations on this platform.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-org"><Plus className="h-4 w-4 mr-2" />Add Organization</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Organization</DialogTitle><DialogDescription>Add a new cemetery organization to the platform.</DialogDescription></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Name</Label><Input className="mt-1" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Greenwood Cemetery" data-testid="input-org-name" /></div>
                <div><Label>Slug</Label><Input className="mt-1" value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') }))} placeholder="greenwood-cemetery" data-testid="input-org-slug" /></div>
              </div>
              <div><Label>Address</Label><Input className="mt-1" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} data-testid="input-org-address" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>City</Label><Input className="mt-1" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} data-testid="input-org-city" /></div>
                <div><Label>Country</Label><Input className="mt-1" value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} data-testid="input-org-country" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Phone</Label><Input className="mt-1" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} data-testid="input-org-phone" /></div>
                <div><Label>Email</Label><Input className="mt-1" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} data-testid="input-org-email" /></div>
              </div>
              <div><Label>Website</Label><Input className="mt-1" value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} placeholder="https://..." data-testid="input-org-website" /></div>
              <Button onClick={handleCreate} disabled={createOrg.isPending} className="w-full" data-testid="button-submit-org">
                {createOrg.isPending ? "Creating..." : "Create Organization"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">{[1,2].map(i => <Card key={i} className="h-40 animate-pulse bg-muted" />)}</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {orgs?.map(org => (
            <Card key={org.id} className="hover:border-primary/40 transition-colors" data-testid={`card-org-${org.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{org.name}</CardTitle>
                      <p className="text-xs text-muted-foreground font-mono">{org.slug}</p>
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => { deleteOrg.mutate({ id: org.id }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListOrganizationsQueryKey() }) }); }} data-testid={`button-delete-org-${org.id}`}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {org.address && <div className="flex items-center gap-2 text-sm text-muted-foreground"><MapPin className="h-3.5 w-3.5" />{org.address}, {org.city}, {org.country}</div>}
                {org.phone && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Phone className="h-3.5 w-3.5" />{org.phone}</div>}
                {org.website && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Globe className="h-3.5 w-3.5" /><a href={org.website} target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">{org.website}</a></div>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
