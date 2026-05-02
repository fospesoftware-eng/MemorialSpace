import { useState } from "react";
import { useListOrganizations, useCreateOrganization, useDeleteOrganization, getListOrganizationsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Building2, MapPin, Phone, Globe, Trash2, Church, House, PawPrint, Landmark, Box } from "lucide-react";

// Mirrors lib/db/src/schema/organizations.ts CEMETERY_TYPES.
const CEMETERY_TYPE_OPTIONS = [
  { value: "church",       label: "Church Cemetery",   icon: Church,   help: "Parish or religious cemetery. Can also run a columbarium on-site." },
  { value: "private",      label: "Private Cemetery",  icon: House,    help: "Privately owned and operated cemetery." },
  { value: "pet",          label: "Pet Cemetery",      icon: PawPrint, help: "Cemetery for companion animals." },
  { value: "municipality", label: "Municipal Cemetery",icon: Landmark, help: "City, county, or government-run cemetery." },
  { value: "columbarium",  label: "Columbarium",       icon: Box,      help: "Stand-alone facility for cremation niches (no in-ground burials)." },
] as const;

type CemeteryType = (typeof CEMETERY_TYPE_OPTIONS)[number]["value"];

const EMPTY_FORM = {
  name: "", slug: "", cemeteryType: "private" as CemeteryType, featuresColumbarium: false,
  address: "", city: "", country: "", phone: "", email: "", website: "",
};

export default function Organizations() {
  const queryClient = useQueryClient();
  const { data: orgs, isLoading } = useListOrganizations();
  const createOrg = useCreateOrganization();
  const deleteOrg = useDeleteOrganization();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  // The "columbarium" type implicitly enables the columbarium module; only
  // "church" cemeteries get the optional checkbox to add it as an extra.
  const showColumbariumCheckbox = form.cemeteryType === "church";
  const effectiveFeaturesColumbarium =
    form.cemeteryType === "columbarium" ? true : form.featuresColumbarium;

  const handleCreate = () => {
    createOrg.mutate(
      { data: {
        name: form.name, slug: form.slug,
        cemeteryType: form.cemeteryType,
        featuresColumbarium: effectiveFeaturesColumbarium,
        address: form.address, city: form.city, country: form.country,
        phone: form.phone, email: form.email, website: form.website,
      } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListOrganizationsQueryKey() });
          setOpen(false);
          setForm(EMPTY_FORM);
        },
      }
    );
  };

  const typeMeta = (val: string | null | undefined) =>
    CEMETERY_TYPE_OPTIONS.find((o) => o.value === val) ?? CEMETERY_TYPE_OPTIONS[1];

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
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>New Organization</DialogTitle><DialogDescription>Add a new cemetery organization to the platform.</DialogDescription></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Name</Label><Input className="mt-1" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Greenwood Cemetery" data-testid="input-org-name" /></div>
                <div><Label>Slug</Label><Input className="mt-1" value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') }))} placeholder="greenwood-cemetery" data-testid="input-org-slug" /></div>
              </div>

              {/* Cemetery type — asked at signup, drives which modules are
                  enabled (e.g. the Columbarium module). */}
              <div>
                <Label htmlFor="cemetery-type-select">Cemetery type</Label>
                <Select
                  value={form.cemeteryType}
                  onValueChange={(v) => setForm(f => ({ ...f, cemeteryType: v as CemeteryType }))}
                >
                  <SelectTrigger id="cemetery-type-select" className="mt-1" data-testid="select-cemetery-type">
                    <SelectValue placeholder="Select cemetery type" />
                  </SelectTrigger>
                  <SelectContent>
                    {CEMETERY_TYPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} data-testid={`option-cemetery-type-${opt.value}`}>
                        <div className="flex items-center gap-2">
                          <opt.icon className="h-4 w-4 text-muted-foreground" />
                          <span>{opt.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground mt-1">{typeMeta(form.cemeteryType).help}</p>
              </div>

              {showColumbariumCheckbox && (
                <div className="flex items-start gap-3 rounded-md border border-border bg-muted/30 p-3">
                  <Checkbox
                    id="features-columbarium"
                    checked={form.featuresColumbarium}
                    onCheckedChange={(v) => setForm(f => ({ ...f, featuresColumbarium: v === true }))}
                    data-testid="check-features-columbarium"
                  />
                  <div className="text-sm leading-snug">
                    <Label htmlFor="features-columbarium" className="cursor-pointer font-medium">Add columbarium module</Label>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Enable the dedicated Columbarium module so this church cemetery can also manage cremation niches with photos and a 3D wall view.</p>
                  </div>
                </div>
              )}

              {form.cemeteryType === "columbarium" && (
                <div className="rounded-md border border-primary/40 bg-primary/5 p-3 text-xs text-muted-foreground">
                  Columbarium module is enabled by default for stand-alone columbarium facilities.
                </div>
              )}

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
              <Button onClick={handleCreate} disabled={createOrg.isPending || !form.name || !form.slug} className="w-full" data-testid="button-submit-org">
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
                      {(() => { const Ic = typeMeta(org.cemeteryType).icon; return <Ic className="h-5 w-5 text-primary" />; })()}
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-base truncate">{org.name}</CardTitle>
                      <p className="text-xs text-muted-foreground font-mono truncate">{org.slug}</p>
                      <div className="mt-1 flex items-center gap-1 flex-wrap">
                        <span className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          {typeMeta(org.cemeteryType).label.replace(" Cemetery", "")}
                        </span>
                        {org.featuresColumbarium && (
                          <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                            <Box className="h-2.5 w-2.5" /> columbarium
                          </span>
                        )}
                      </div>
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
