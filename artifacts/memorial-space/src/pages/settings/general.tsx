import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Bell,
  Building2,
  MapPin,
  Shield,
  Palette,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const ORG_ID = 1;

type Organization = {
  id: number;
  name: string;
  slug: string;
  cemeteryType: string;
  address: string | null;
  city: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  logoUrl: string | null;
  latitude: number | null;
  longitude: number | null;
};

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
}

const EMPTY_FORM = {
  name: "",
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

export default function GeneralSettings() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState<typeof EMPTY_FORM>(EMPTY_FORM);

  const orgQuery = useQuery({
    queryKey: ["organizations"],
    queryFn: async () => {
      const orgs = await api<Organization[]>("/api/organizations");
      return orgs.find((o) => o.id === ORG_ID) ?? null;
    },
  });

  useEffect(() => {
    const o = orgQuery.data;
    if (!o) return;
    setForm({
      name: o.name ?? "",
      address: o.address ?? "",
      city: o.city ?? "",
      country: o.country ?? "",
      phone: o.phone ?? "",
      email: o.email ?? "",
      website: o.website ?? "",
      logoUrl: o.logoUrl ?? "",
      latitude: o.latitude == null ? "" : String(o.latitude),
      longitude: o.longitude == null ? "" : String(o.longitude),
    });
  }, [orgQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const o = orgQuery.data;
      if (!o) throw new Error("Cemetery record not loaded yet");
      const lat = form.latitude.trim() === "" ? null : Number(form.latitude);
      const lng = form.longitude.trim() === "" ? null : Number(form.longitude);
      if (lat != null && (Number.isNaN(lat) || lat < -90 || lat > 90)) {
        throw new Error("Latitude must be a number between -90 and 90");
      }
      if (lng != null && (Number.isNaN(lng) || lng < -180 || lng > 180)) {
        throw new Error("Longitude must be a number between -180 and 180");
      }
      const payload = {
        name: form.name.trim() || o.name,
        slug: o.slug,
        cemeteryType: o.cemeteryType,
        address: form.address.trim() || null,
        city: form.city.trim() || null,
        country: form.country.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        website: form.website.trim() || null,
        logoUrl: form.logoUrl.trim() || null,
        latitude: lat,
        longitude: lng,
      };
      return api<Organization>(`/api/organizations/${o.id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["organizations"] });
      toast({
        title: "Cemetery details saved",
        description: "Your changes are live across the platform.",
      });
    },
    onError: (err) => {
      toast({
        title: "Could not save",
        description: String((err as Error).message),
        variant: "destructive",
      });
    },
  });

  const update =
    (k: keyof typeof EMPTY_FORM) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      toast({ title: "Geolocation not supported", variant: "destructive" });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) => ({
          ...f,
          latitude: pos.coords.latitude.toFixed(6),
          longitude: pos.coords.longitude.toFixed(6),
        }));
        toast({
          title: "Location captured",
          description: "Don't forget to save changes.",
        });
      },
      (err) =>
        toast({
          title: "Could not get location",
          description: err.message,
          variant: "destructive",
        }),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Cemetery Details</h1>
        <p className="text-muted-foreground mt-1">
          Add and maintain the cemetery location, contacts, map coordinates, and
          operator preferences.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Cemetery Details</CardTitle>
          </div>
          <CardDescription>
            Public-facing information used across your dashboard, public site,
            invoices, and obituaries.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {orgQuery.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading cemetery
              details…
            </div>
          ) : !orgQuery.data ? (
            <p className="text-sm text-destructive">
              Cemetery record not found.
            </p>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <Label htmlFor="cem-name">Cemetery name</Label>
                  <Input
                    id="cem-name"
                    className="mt-1"
                    value={form.name}
                    onChange={update("name")}
                    placeholder="e.g. Greenwood Memorial Park"
                    data-testid="input-cemetery-name"
                  />
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="cem-address">Street address</Label>
                  <Textarea
                    id="cem-address"
                    className="mt-1"
                    rows={2}
                    value={form.address}
                    onChange={update("address")}
                    placeholder="1200 Cemetery Road"
                    data-testid="input-cemetery-address"
                  />
                </div>

                <div>
                  <Label htmlFor="cem-city">City / region</Label>
                  <Input
                    id="cem-city"
                    className="mt-1"
                    value={form.city}
                    onChange={update("city")}
                    placeholder="San Francisco, CA"
                    data-testid="input-cemetery-city"
                  />
                </div>

                <div>
                  <Label htmlFor="cem-country">Country</Label>
                  <Input
                    id="cem-country"
                    className="mt-1"
                    value={form.country}
                    onChange={update("country")}
                    placeholder="United States"
                    data-testid="input-cemetery-country"
                  />
                </div>

                <div>
                  <Label htmlFor="cem-phone">Phone</Label>
                  <Input
                    id="cem-phone"
                    className="mt-1"
                    value={form.phone}
                    onChange={update("phone")}
                    placeholder="+1-415-555-0100"
                    data-testid="input-cemetery-phone"
                  />
                </div>

                <div>
                  <Label htmlFor="cem-email">Email</Label>
                  <Input
                    id="cem-email"
                    type="email"
                    className="mt-1"
                    value={form.email}
                    onChange={update("email")}
                    placeholder="admin@greenwood.com"
                    data-testid="input-cemetery-email"
                  />
                </div>

                <div>
                  <Label htmlFor="cem-website">Website</Label>
                  <Input
                    id="cem-website"
                    className="mt-1"
                    value={form.website}
                    onChange={update("website")}
                    placeholder="https://greenwood.com"
                    data-testid="input-cemetery-website"
                  />
                </div>

                <div>
                  <Label htmlFor="cem-logo">Logo URL</Label>
                  <Input
                    id="cem-logo"
                    className="mt-1"
                    value={form.logoUrl}
                    onChange={update("logoUrl")}
                    placeholder="https://your-logo.png"
                    data-testid="input-cemetery-logo"
                  />
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    <Label className="font-medium">
                      Geographic coordinates
                    </Label>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={useMyLocation}
                    data-testid="button-use-my-location"
                  >
                    Use my current location
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  Used on the public site map and for "directions to" links.
                  Decimal degrees, e.g. 37.7749, -122.4194.
                </p>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="cem-lat">Latitude</Label>
                    <Input
                      id="cem-lat"
                      className="mt-1"
                      inputMode="decimal"
                      value={form.latitude}
                      onChange={update("latitude")}
                      placeholder="37.7749"
                      data-testid="input-cemetery-latitude"
                    />
                  </div>
                  <div>
                    <Label htmlFor="cem-lng">Longitude</Label>
                    <Input
                      id="cem-lng"
                      className="mt-1"
                      inputMode="decimal"
                      value={form.longitude}
                      onChange={update("longitude")}
                      placeholder="-122.4194"
                      data-testid="input-cemetery-longitude"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  size="sm"
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending || !orgQuery.data}
                  data-testid="button-save-cemetery"
                >
                  {saveMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving…
                    </>
                  ) : (
                    "Save cemetery details"
                  )}
                </Button>
                {saveMutation.isSuccess && !saveMutation.isPending && (
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Saved
                  </span>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Notifications</CardTitle>
            </div>
            <CardDescription>
              Email and system notification preferences
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              {
                label: "New booking notifications",
                id: "notif-booking",
                defaultChecked: true,
              },
              {
                label: "Work order updates",
                id: "notif-workorder",
                defaultChecked: true,
              },
              {
                label: "QR code scan alerts",
                id: "notif-qr",
                defaultChecked: false,
              },
              {
                label: "Weekly summary reports",
                id: "notif-weekly",
                defaultChecked: true,
              },
            ].map((item) => (
              <div key={item.id} className="flex items-center justify-between">
                <Label htmlFor={item.id} className="cursor-pointer">
                  {item.label}
                </Label>
                <Switch
                  id={item.id}
                  defaultChecked={item.defaultChecked}
                  data-testid={`switch-${item.id}`}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Security</CardTitle>
            </div>
            <CardDescription>
              Access control and security settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              {
                label: "Two-factor authentication",
                id: "sec-2fa",
                defaultChecked: false,
              },
              {
                label: "Require email verification",
                id: "sec-email",
                defaultChecked: true,
              },
              {
                label: "Session timeout (8h)",
                id: "sec-timeout",
                defaultChecked: true,
              },
            ].map((item) => (
              <div key={item.id} className="flex items-center justify-between">
                <Label htmlFor={item.id} className="cursor-pointer">
                  {item.label}
                </Label>
                <Switch
                  id={item.id}
                  defaultChecked={item.defaultChecked}
                  data-testid={`switch-${item.id}`}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Palette className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Appearance</CardTitle>
            </div>
            <CardDescription>
              Operator dashboard theme. To brand your <strong>public</strong>{" "}
              cemetery site, use{" "}
              <a
                href="/app/site-builder"
                className="text-primary hover:underline"
              >
                Website Builder
              </a>
              .
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Use the sun / moon toggle in the sidebar to switch between light
              and dark mode for your dashboard. Your preference is saved to this
              browser.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
