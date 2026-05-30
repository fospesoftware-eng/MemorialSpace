import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowRight,
  Box,
  Building2,
  Calendar,
  Church,
  Edit3,
  ExternalLink,
  Globe,
  House,
  Landmark,
  Layers,
  Loader2,
  Map,
  MapPin,
  PawPrint,
  Phone,
  Plus,
  Trash2,
  Users,
  Wand2,
  Wrench,
} from "lucide-react";

const CEMETERIES_QUERY_KEY = ["organizations"];

const CEMETERY_TYPE_OPTIONS = [
  {
    value: "church",
    label: "Church Cemetery",
    icon: Church,
    help: "Parish or religious cemetery. Can also run a columbarium on-site.",
  },
  {
    value: "private",
    label: "Private Cemetery",
    icon: House,
    help: "Privately owned and operated cemetery.",
  },
  {
    value: "pet",
    label: "Pet Cemetery",
    icon: PawPrint,
    help: "Cemetery for companion animals.",
  },
  {
    value: "municipality",
    label: "Municipal Cemetery",
    icon: Landmark,
    help: "City, county, or government-run cemetery.",
  },
  {
    value: "columbarium",
    label: "Columbarium",
    icon: Box,
    help: "Stand-alone facility for cremation niches.",
  },
] as const;

type CemeteryType = (typeof CEMETERY_TYPE_OPTIONS)[number]["value"];

type Cemetery = {
  id: number;
  name: string;
  slug: string;
  cemeteryType: CemeteryType;
  featuresColumbarium: boolean;
  address: string | null;
  city: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  logoUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  totalPlots: number | null;
  status: string;
};

const EMPTY_FORM = {
  name: "",
  slug: "",
  cemeteryType: "private" as CemeteryType,
  featuresColumbarium: false,
  address: "",
  city: "",
  country: "",
  phone: "",
  email: "",
  website: "",
  logoUrl: "",
  latitude: "",
  longitude: "",
};

type CemeteryForm = typeof EMPTY_FORM;

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    credentials: "include",
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(body?.error ?? `Request failed (${res.status})`);
  return body as T;
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toForm(cemetery: Cemetery): CemeteryForm {
  return {
    name: cemetery.name ?? "",
    slug: cemetery.slug ?? "",
    cemeteryType: cemetery.cemeteryType ?? "private",
    featuresColumbarium: Boolean(cemetery.featuresColumbarium),
    address: cemetery.address ?? "",
    city: cemetery.city ?? "",
    country: cemetery.country ?? "",
    phone: cemetery.phone ?? "",
    email: cemetery.email ?? "",
    website: cemetery.website ?? "",
    logoUrl: cemetery.logoUrl ?? "",
    latitude: cemetery.latitude == null ? "" : String(cemetery.latitude),
    longitude: cemetery.longitude == null ? "" : String(cemetery.longitude),
  };
}

function cleanNullable(value: string) {
  return value.trim() || null;
}

function toPayload(form: CemeteryForm) {
  const latitude = form.latitude.trim() ? Number(form.latitude) : null;
  const longitude = form.longitude.trim() ? Number(form.longitude) : null;
  if (latitude != null && (Number.isNaN(latitude) || latitude < -90 || latitude > 90)) {
    throw new Error("Latitude must be between -90 and 90.");
  }
  if (longitude != null && (Number.isNaN(longitude) || longitude < -180 || longitude > 180)) {
    throw new Error("Longitude must be between -180 and 180.");
  }
  return {
    name: form.name.trim(),
    slug: slugify(form.slug || form.name),
    cemeteryType: form.cemeteryType,
    featuresColumbarium:
      form.cemeteryType === "columbarium" ||
      (form.cemeteryType === "church" && form.featuresColumbarium),
    address: cleanNullable(form.address),
    city: cleanNullable(form.city),
    country: cleanNullable(form.country),
    phone: cleanNullable(form.phone),
    email: cleanNullable(form.email),
    website: cleanNullable(form.website),
    logoUrl: cleanNullable(form.logoUrl),
    latitude,
    longitude,
  };
}

const workflowLinks = [
  { label: "Map Maker", href: "/map-maker", icon: Layers },
  { label: "AI Map Maker", href: "/ai-map-maker", icon: Wand2 },
  { label: "Map View", href: "/map", icon: Map },
  { label: "Burial Spots", href: "/burial-spots", icon: MapPin },
  { label: "Bookings", href: "/bookings", icon: Calendar },
  { label: "Work Orders", href: "/work-orders", icon: Wrench },
];

function typeMeta(val: string | null | undefined) {
  return (
    CEMETERY_TYPE_OPTIONS.find((option) => option.value === val) ??
    CEMETERY_TYPE_OPTIONS[1]
  );
}

export default function CemeteriesPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Cemetery | null>(null);
  const [form, setForm] = useState<CemeteryForm>(EMPTY_FORM);

  const { data: cemeteries = [], isLoading } = useQuery({
    queryKey: CEMETERIES_QUERY_KEY,
    queryFn: () => api<Cemetery[]>("/api/organizations"),
  });

  const stats = useMemo(
    () => ({
      total: cemeteries.length,
      active: cemeteries.filter((cemetery) => cemetery.status === "active").length,
      spots: cemeteries.reduce(
        (sum, cemetery) => sum + Number(cemetery.totalPlots ?? 0),
        0,
      ),
    }),
    [cemeteries],
  );

  useEffect(() => {
    if (editing) setForm(toForm(editing));
    else setForm(EMPTY_FORM);
  }, [editing, open]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = toPayload(form);
      if (!payload.name || !payload.slug) {
        throw new Error("Cemetery name and slug are required.");
      }
      return editing
        ? api<Cemetery>(`/api/organizations/${editing.id}`, {
            method: "PUT",
            body: JSON.stringify(payload),
          })
        : api<Cemetery>("/api/organizations", {
            method: "POST",
            body: JSON.stringify(payload),
          });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: CEMETERIES_QUERY_KEY });
      toast({
        title: editing ? "Cemetery updated" : "Cemetery created",
        description: "This cemetery is now available across the operator tools.",
      });
      setOpen(false);
      setEditing(null);
      setForm(EMPTY_FORM);
    },
    onError: (err) =>
      toast({
        title: "Could not save cemetery",
        description: String((err as Error).message),
        variant: "destructive",
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      api<void>(`/api/organizations/${id}`, { method: "DELETE" }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: CEMETERIES_QUERY_KEY }),
    onError: (err) =>
      toast({
        title: "Could not delete cemetery",
        description: String((err as Error).message),
        variant: "destructive",
      }),
  });

  const startCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  };

  const startEdit = (cemetery: Cemetery) => {
    setEditing(cemetery);
    setForm(toForm(cemetery));
    setOpen(true);
  };

  const showColumbariumCheckbox = form.cemeteryType === "church";

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            <Building2 className="h-4 w-4" />
            Cemetery database
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Cemeteries</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Create and manage cemeteries in one global list. Each cemetery can
            move into Map Maker, AI Map Maker, Map View, Burial Spots, bookings,
            work orders, and the rest of the operator workflow.
          </p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={startCreate} data-testid="button-create-org">
              <Plus className="mr-2 h-4 w-4" />
              New cemetery
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editing ? "Edit cemetery" : "Create new cemetery"}
              </DialogTitle>
              <DialogDescription>
                This cemetery profile is shared by maps, burial spots, imports,
                public site content, and operations tools.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <Label>Cemetery name</Label>
                  <Input
                    className="mt-1"
                    value={form.name}
                    onChange={(e) =>
                      setForm((current) => ({
                        ...current,
                        name: e.target.value,
                        slug:
                          editing || current.slug
                            ? current.slug
                            : slugify(e.target.value),
                      }))
                    }
                    placeholder="Greenwood Cemetery"
                    data-testid="input-org-name"
                  />
                </div>
                <div>
                  <Label>Slug</Label>
                  <Input
                    className="mt-1"
                    value={form.slug}
                    onChange={(e) =>
                      setForm((current) => ({
                        ...current,
                        slug: slugify(e.target.value),
                      }))
                    }
                    placeholder="greenwood-cemetery"
                    data-testid="input-org-slug"
                  />
                </div>
                <div>
                  <Label>Cemetery type</Label>
                  <Select
                    value={form.cemeteryType}
                    onValueChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        cemeteryType: value as CemeteryType,
                      }))
                    }
                  >
                    <SelectTrigger className="mt-1" data-testid="select-cemetery-type">
                      <SelectValue placeholder="Select cemetery type" />
                    </SelectTrigger>
                    <SelectContent>
                      {CEMETERY_TYPE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <div className="flex items-center gap-2">
                            <option.icon className="h-4 w-4 text-muted-foreground" />
                            {option.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {typeMeta(form.cemeteryType).help}
                  </p>
                </div>
              </div>

              {showColumbariumCheckbox && (
                <div className="flex items-start gap-3 rounded-md border border-border bg-muted/30 p-3">
                  <Checkbox
                    id="features-columbarium"
                    checked={form.featuresColumbarium}
                    onCheckedChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        featuresColumbarium: value === true,
                      }))
                    }
                    data-testid="check-features-columbarium"
                  />
                  <div className="text-sm leading-snug">
                    <Label htmlFor="features-columbarium" className="cursor-pointer font-medium">
                      Add columbarium module
                    </Label>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Enable niche inventory for this cemetery.
                    </p>
                  </div>
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <Label>Address</Label>
                  <Textarea
                    className="mt-1"
                    rows={2}
                    value={form.address}
                    onChange={(e) =>
                      setForm((current) => ({ ...current, address: e.target.value }))
                    }
                    placeholder="1200 Cemetery Road"
                    data-testid="input-org-address"
                  />
                </div>
                <div>
                  <Label>City / region</Label>
                  <Input
                    className="mt-1"
                    value={form.city}
                    onChange={(e) =>
                      setForm((current) => ({ ...current, city: e.target.value }))
                    }
                    data-testid="input-org-city"
                  />
                </div>
                <div>
                  <Label>Country</Label>
                  <Input
                    className="mt-1"
                    value={form.country}
                    onChange={(e) =>
                      setForm((current) => ({ ...current, country: e.target.value }))
                    }
                    data-testid="input-org-country"
                  />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input
                    className="mt-1"
                    value={form.phone}
                    onChange={(e) =>
                      setForm((current) => ({ ...current, phone: e.target.value }))
                    }
                    data-testid="input-org-phone"
                  />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input
                    className="mt-1"
                    type="email"
                    value={form.email}
                    onChange={(e) =>
                      setForm((current) => ({ ...current, email: e.target.value }))
                    }
                    data-testid="input-org-email"
                  />
                </div>
                <div>
                  <Label>Website</Label>
                  <Input
                    className="mt-1"
                    value={form.website}
                    onChange={(e) =>
                      setForm((current) => ({ ...current, website: e.target.value }))
                    }
                    placeholder="https://..."
                    data-testid="input-org-website"
                  />
                </div>
                <div>
                  <Label>Logo URL</Label>
                  <Input
                    className="mt-1"
                    value={form.logoUrl}
                    onChange={(e) =>
                      setForm((current) => ({ ...current, logoUrl: e.target.value }))
                    }
                    placeholder="https://your-logo.png"
                  />
                </div>
                <div>
                  <Label>Latitude</Label>
                  <Input
                    className="mt-1"
                    inputMode="decimal"
                    value={form.latitude}
                    onChange={(e) =>
                      setForm((current) => ({ ...current, latitude: e.target.value }))
                    }
                    placeholder="37.7749"
                  />
                </div>
                <div>
                  <Label>Longitude</Label>
                  <Input
                    className="mt-1"
                    inputMode="decimal"
                    value={form.longitude}
                    onChange={(e) =>
                      setForm((current) => ({ ...current, longitude: e.target.value }))
                    }
                    placeholder="-122.4194"
                  />
                </div>
              </div>

              <Button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || !form.name.trim()}
                className="w-full"
                data-testid="button-submit-org"
              >
                {saveMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving cemetery
                  </>
                ) : editing ? (
                  "Save cemetery"
                ) : (
                  "Create cemetery"
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Cemeteries
            </p>
            <p className="mt-2 text-2xl font-semibold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Active
            </p>
            <p className="mt-2 text-2xl font-semibold">{stats.active}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Burial spots
            </p>
            <p className="mt-2 text-2xl font-semibold">{stats.spots}</p>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {[1, 2].map((item) => (
            <Card key={item} className="h-64 animate-pulse bg-muted" />
          ))}
        </div>
      ) : cemeteries.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-14 text-center">
            <Building2 className="h-10 w-10 text-muted-foreground" />
            <h2 className="mt-4 text-lg font-semibold">No cemeteries yet</h2>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Create the first cemetery to unlock map making, burial spots, and
              operations workflows.
            </p>
            <Button onClick={startCreate} className="mt-5 gap-2">
              <Plus className="h-4 w-4" />
              New cemetery
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {cemeteries.map((cemetery) => {
            const meta = typeMeta(cemetery.cemeteryType);
            const TypeIcon = meta.icon;
            return (
              <Card
                key={cemetery.id}
                className="overflow-hidden border-border/70 transition-colors hover:border-primary/40"
                data-testid={`card-org-${cemetery.id}`}
              >
                <CardHeader className="border-b border-border/60 pb-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary/10">
                        <TypeIcon className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="truncate text-lg">
                          {cemetery.name}
                        </CardTitle>
                        <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
                          {cemetery.slug}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <Badge variant="outline">{meta.label}</Badge>
                          <Badge variant={cemetery.status === "active" ? "default" : "outline"}>
                            {cemetery.status}
                          </Badge>
                          {cemetery.featuresColumbarium && (
                            <Badge variant="outline" className="gap-1">
                              <Box className="h-3 w-3" />
                              Columbarium
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-2"
                        onClick={() => startEdit(cemetery)}
                        data-testid={`button-edit-org-${cemetery.id}`}
                      >
                        <Edit3 className="h-4 w-4" />
                        Edit
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => deleteMutation.mutate(cemetery.id)}
                        disabled={deleteMutation.isPending}
                        data-testid={`button-delete-org-${cemetery.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                        <span className="sr-only">Delete cemetery</span>
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 p-4">
                  <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                    {(cemetery.address || cemetery.city || cemetery.country) && (
                      <div className="flex items-start gap-2">
                        <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>
                          {[cemetery.address, cemetery.city, cemetery.country]
                            .filter(Boolean)
                            .join(", ")}
                        </span>
                      </div>
                    )}
                    {cemetery.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 shrink-0" />
                        {cemetery.phone}
                      </div>
                    )}
                    {cemetery.website && (
                      <a
                        href={cemetery.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-primary hover:underline"
                      >
                        <Globe className="h-4 w-4 shrink-0" />
                        Website
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 shrink-0" />
                      {cemetery.totalPlots ?? 0} burial spots
                    </div>
                  </div>

                  <div className="rounded-md border border-border/70 bg-muted/20 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">Cemetery workflow</p>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {workflowLinks.map((tool) => (
                        <Button
                          key={tool.href}
                          asChild
                          variant="outline"
                          size="sm"
                          className="justify-start gap-2 bg-background/70"
                        >
                          <Link href={tool.href}>
                            <tool.icon className="h-4 w-4" />
                            {tool.label}
                          </Link>
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-md border border-primary/20 bg-primary/5 p-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">Published interactive map</p>
                        <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
                          /map-maker/preview/{cemetery.slug}
                        </p>
                      </div>
                      <Button asChild size="sm" variant="outline" className="shrink-0 gap-2 bg-background/80">
                        <Link href={`/map-maker/preview/${cemetery.slug}`}>
                          <ExternalLink className="h-4 w-4" />
                          Open map URL
                        </Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
