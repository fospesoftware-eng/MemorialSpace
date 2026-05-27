/**
 * Vendor profile editor — business info, contact, categories, service areas,
 * and the publish toggle that controls whether the vendor appears in the
 * public directory `/vendors`.
 */
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Save, Globe2, EyeOff, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { useVendorMe, useUpdateVendor } from "./api";

export default function VendorProfile() {
  const { data, isLoading } = useVendorMe();
  const update = useUpdateVendor();
  const v = data?.vendor;

  const [businessName, setBusinessName] = useState("");
  const [description, setDescription] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [categoriesText, setCategoriesText] = useState("");
  const [areasText, setAreasText] = useState("");
  const [isPublished, setIsPublished] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Hydrate the form once when the vendor loads. We deliberately don't
  // re-sync on every render so the user's in-progress edits aren't blown
  // away by a stale refetch.
  useEffect(() => {
    if (!v) return;
    setBusinessName(v.businessName);
    setDescription(v.description ?? "");
    setContactName(v.contactName ?? "");
    setContactPhone(v.contactPhone ?? "");
    setWebsiteUrl(v.websiteUrl ?? "");
    setLogoUrl(v.logoUrl ?? "");
    setCategoriesText((v.categories ?? []).join(", "));
    setAreasText((v.serviceAreas ?? []).join(", "));
    setIsPublished(v.isPublished);
  }, [v?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading || !v) {
    return <div className="text-sm text-muted-foreground">Loading profile…</div>;
  }

  const splitTrim = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

  const save = async () => {
    setError(null);
    setSaved(false);
    try {
      await update.mutateAsync({
        businessName: businessName.trim(),
        description: description.trim() || null,
        contactName: contactName.trim() || null,
        contactPhone: contactPhone.trim() || null,
        websiteUrl: websiteUrl.trim() || null,
        logoUrl: logoUrl.trim() || null,
        categories: splitTrim(categoriesText),
        serviceAreas: splitTrim(areasText),
        isPublished,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Business profile</h1>
          <p className="text-muted-foreground mt-1">Tell families who you are, what you offer, and where you serve.</p>
        </div>
        <div className="flex items-center gap-3 self-start">
          {isPublished ? (
            <Badge variant="outline" className="border-emerald-400/40 text-emerald-300 bg-emerald-400/5">
              <Globe2 className="h-3 w-3 mr-1" /> Live in directory
            </Badge>
          ) : (
            <Badge variant="outline" className="border-amber-400/40 text-amber-300 bg-amber-400/5">
              <EyeOff className="h-3 w-3 mr-1" /> Hidden
            </Badge>
          )}
        </div>
      </div>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-base">Visibility</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-md border border-border/60 bg-muted/30 p-4">
            <div>
              <p className="font-medium">Show in public directory</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Families browsing <code className="text-foreground">/vendors</code> will see and contact you.
              </p>
            </div>
            <Switch checked={isPublished} onCheckedChange={setIsPublished} data-testid="switch-published" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader><CardTitle className="text-base">Business details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="bn">Business name</Label>
              <Input id="bn" value={businessName} onChange={(e) => setBusinessName(e.target.value)} data-testid="input-business-name" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cn">Contact name</Label>
              <Input id="cn" value={contactName} onChange={(e) => setContactName(e.target.value)} data-testid="input-contact-name" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cp">Contact phone</Label>
              <Input id="cp" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} data-testid="input-contact-phone" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wu">Website URL</Label>
              <Input id="wu" type="url" placeholder="https://" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} data-testid="input-website" />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="lu">Logo URL</Label>
              <Input id="lu" type="url" placeholder="https://" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} data-testid="input-logo" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="desc">About your business</Label>
            <Textarea id="desc" rows={5} value={description} onChange={(e) => setDescription(e.target.value)} data-testid="input-description" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader><CardTitle className="text-base">Categories &amp; service area</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cats">Categories</Label>
            <Input
              id="cats"
              value={categoriesText}
              onChange={(e) => setCategoriesText(e.target.value)}
              placeholder="florist, catering, transport"
              data-testid="input-categories"
            />
            <p className="text-[11px] text-muted-foreground">
              Comma-separated tags families will filter by — e.g. <code>florist</code>, <code>monument</code>, <code>catering</code>, <code>transport</code>.
            </p>
            {splitTrim(categoriesText).length > 0 ? (
              <div className="flex flex-wrap gap-1.5 pt-2">
                {splitTrim(categoriesText).map((c) => (
                  <Badge key={c} variant="secondary" className="text-[11px]">{c}</Badge>
                ))}
              </div>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="areas">Service areas</Label>
            <Input
              id="areas"
              value={areasText}
              onChange={(e) => setAreasText(e.target.value)}
              placeholder="Seattle, Bellevue, Tacoma"
              data-testid="input-areas"
            />
            <p className="text-[11px] text-muted-foreground">
              Cities or regions you serve. Comma-separated. Families filter the directory by area.
            </p>
            {splitTrim(areasText).length > 0 ? (
              <div className="flex flex-wrap gap-1.5 pt-2">
                {splitTrim(areasText).map((a) => (
                  <Badge key={a} variant="outline" className="text-[11px]">{a}</Badge>
                ))}
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {error ? (
        <div className="rounded-md border border-rose-500/40 bg-rose-500/10 text-rose-300 px-3 py-2 text-xs flex items-center gap-2" data-testid="profile-error">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" /> <span>{error}</span>
        </div>
      ) : null}
      {saved ? (
        <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 px-3 py-2 text-xs flex items-center gap-2" data-testid="profile-saved">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> Profile saved.
        </div>
      ) : null}

      <div className="flex justify-end gap-3">
        <Button onClick={save} disabled={update.isPending} className="bg-primary hover:bg-primary/90" data-testid="button-save">
          {update.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving…</> : <><Save className="h-4 w-4 mr-2" />Save profile</>}
        </Button>
      </div>
    </div>
  );
}
