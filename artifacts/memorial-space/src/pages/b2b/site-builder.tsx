import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Globe,
  Eye,
  Plus,
  Trash2,
  Edit,
  Image as ImageIcon,
  CreditCard,
  Tag,
  Package,
  Star,
  ExternalLink,
  RefreshCw,
  ShoppingBag,
} from "lucide-react";
import { THEMES, type ThemeKey } from "../cemetery-site/themes";

const ORG_ID = 1;
const BASE = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");

type Site = {
  id: number;
  organizationId: number;
  theme: string;
  siteTitle: string;
  tagline: string | null;
  heroHeadline: string | null;
  heroSubheadline: string | null;
  heroImageUrl: string | null;
  aboutText: string | null;
  primaryColorOverride: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  contactAddress: string | null;
  openingHours: string | null;
  isPublished: boolean;
  inquiryEmail: string | null;
  stripeAccountId: string | null;
};

type Category = {
  id: number;
  name: string;
  slug: string;
  icon: string | null;
  sortOrder: number;
};

type Product = {
  id: number;
  categoryId: number | null;
  name: string;
  slug: string;
  shortDescription: string | null;
  description: string | null;
  price: number;
  compareAtPrice: number | null;
  type: "product" | "service";
  stockQuantity: number | null;
  photos: string[];
  isFeatured: boolean;
  isPublished: boolean;
  stripeEnabled: boolean;
  sortOrder: number;
};

type Order = {
  id: number;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  customerNotes: string | null;
  items: Array<{ productId: number; name: string; quantity: number; unitPrice: number; lineTotal: number }>;
  subtotal: number;
  total: number;
  status: "new" | "acknowledged" | "in_progress" | "fulfilled" | "cancelled";
  paymentMethod: string;
  paymentStatus: string;
  operatorNotes: string | null;
  createdAt: string;
};

type Org = { id: number; name: string; slug: string };

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  if (res.status === 204) return undefined as T;
  return res.json();
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

async function fileToDataUrl(file: File, maxDim = 1600): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const ratio = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.round(img.width * ratio);
        const h = Math.round(img.height * ratio);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas not supported"));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export default function SiteBuilder() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState("design");

  const { data: org } = useQuery({
    queryKey: ["org", ORG_ID],
    queryFn: () => api<Org[]>(`/api/organizations`).then((rows) => rows.find((o) => o.id === ORG_ID)!),
  });

  const { data: site } = useQuery({
    queryKey: ["site-builder-site", ORG_ID],
    queryFn: () => api<Site>(`/api/cemetery-sites?orgId=${ORG_ID}`),
  });

  const publicUrl = org ? `${BASE}/c/${org.slug}` : "";
  const previewUrl = org ? `${publicUrl}?previewOrgId=${ORG_ID}` : "";

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Globe className="h-4 w-4" />
            Website Builder
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Your Public Cemetery Site</h1>
          <p className="text-muted-foreground mt-1">
            Design your branded site, manage your marketplace, and process incoming orders.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {site?.isPublished ? (
            <Badge className="bg-emerald-600 hover:bg-emerald-600">Published</Badge>
          ) : (
            <Badge variant="secondary">Draft</Badge>
          )}
          {org ? (
            <a
              href={site?.isPublished ? publicUrl : previewUrl}
              target="_blank"
              rel="noreferrer"
              data-testid="link-view-site"
            >
              <Button variant="outline" size="sm">
                <ExternalLink className="h-4 w-4 mr-2" />
                {site?.isPublished ? "View live" : "Preview"}
              </Button>
            </a>
          ) : null}
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="design" data-testid="tab-design">
            <Globe className="h-4 w-4 mr-2" />
            Design
          </TabsTrigger>
          <TabsTrigger value="catalogue" data-testid="tab-catalogue">
            <Package className="h-4 w-4 mr-2" />
            Catalogue
          </TabsTrigger>
          <TabsTrigger value="orders" data-testid="tab-orders">
            <ShoppingBag className="h-4 w-4 mr-2" />
            Orders
          </TabsTrigger>
        </TabsList>

        <TabsContent value="design" className="mt-6">
          <DesignTab site={site} previewUrl={previewUrl} publicUrl={publicUrl} onSaved={() => qc.invalidateQueries({ queryKey: ["site-builder-site", ORG_ID] })} toast={toast} />
        </TabsContent>

        <TabsContent value="catalogue" className="mt-6">
          <CatalogueTab toast={toast} stripeAvailable={Boolean(site?.stripeAccountId)} />
        </TabsContent>

        <TabsContent value="orders" className="mt-6">
          <OrdersTab toast={toast} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------- DESIGN TAB ----------

type ToastFn = ReturnType<typeof useToast>["toast"];

function DesignTab({
  site,
  previewUrl,
  publicUrl,
  onSaved,
  toast,
}: {
  site: Site | undefined;
  previewUrl: string;
  publicUrl: string;
  onSaved: () => void;
  toast: ToastFn;
}) {
  const [form, setForm] = useState<Site | null>(site ?? null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeKey, setIframeKey] = useState(0);

  useEffect(() => {
    if (site) setForm(site);
  }, [site]);

  const save = useMutation({
    mutationFn: (payload: Partial<Site>) =>
      api<Site>(`/api/cemetery-sites?orgId=${ORG_ID}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      onSaved();
      setIframeKey((k) => k + 1);
      toast({ title: "Saved", description: "Your site has been updated." });
    },
    onError: (e) => toast({ title: "Save failed", description: String(e), variant: "destructive" }),
  });

  if (!form) {
    return <p className="text-muted-foreground">Loading…</p>;
  }

  const handleHeroUpload = async (file: File) => {
    try {
      const dataUrl = await fileToDataUrl(file, 2000);
      setForm({ ...form, heroImageUrl: dataUrl });
    } catch (e) {
      toast({ title: "Upload failed", description: String(e), variant: "destructive" });
    }
  };

  const submit = () => {
    if (!form) return;
    const payload: Partial<Site> = {
      theme: form.theme,
      siteTitle: form.siteTitle,
      tagline: form.tagline,
      heroHeadline: form.heroHeadline,
      heroSubheadline: form.heroSubheadline,
      heroImageUrl: form.heroImageUrl,
      aboutText: form.aboutText,
      primaryColorOverride: form.primaryColorOverride,
      contactPhone: form.contactPhone,
      contactEmail: form.contactEmail,
      contactAddress: form.contactAddress,
      openingHours: form.openingHours,
      isPublished: form.isPublished,
      inquiryEmail: form.inquiryEmail,
    };
    save.mutate(payload);
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
      <div className="xl:col-span-2 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Theme</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(Object.keys(THEMES) as ThemeKey[]).map((key) => {
                const t = THEMES[key];
                const active = form.theme === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setForm({ ...form, theme: key })}
                    data-testid={`theme-${key}`}
                    className={`text-left rounded-lg p-3 border-2 transition-all ${active ? "border-primary shadow-md" : "border-border hover:border-primary/50"}`}
                  >
                    <div
                      className="rounded-md h-16 mb-2 overflow-hidden"
                      style={{ background: t.swatch.background, border: "1px solid rgba(0,0,0,0.05)" }}
                    >
                      <div
                        className="h-1/2"
                        style={{ background: t.swatch.primary }}
                      />
                      <div className="p-1.5 text-[10px] font-semibold" style={{ fontFamily: t.fontHeading, color: t.swatch.primary }}>
                        Aa
                      </div>
                    </div>
                    <div className="font-medium text-sm">{t.label}</div>
                    <div className="text-xs text-muted-foreground line-clamp-2">{t.description}</div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Identity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label htmlFor="siteTitle">Site title</Label>
              <Input
                id="siteTitle"
                value={form.siteTitle}
                onChange={(e) => setForm({ ...form, siteTitle: e.target.value })}
                data-testid="input-site-title"
              />
            </div>
            <div>
              <Label htmlFor="tagline">Tagline</Label>
              <Input
                id="tagline"
                value={form.tagline ?? ""}
                onChange={(e) => setForm({ ...form, tagline: e.target.value || null })}
                data-testid="input-tagline"
              />
            </div>
            <div>
              <Label htmlFor="primary">Primary color override (HSL)</Label>
              <div className="flex gap-2 items-center">
                <Input
                  id="primary"
                  placeholder="e.g. 150 45% 28%"
                  value={form.primaryColorOverride ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, primaryColorOverride: e.target.value || null })
                  }
                  data-testid="input-primary-color"
                />
                {form.primaryColorOverride ? (
                  <div
                    className="w-10 h-10 rounded border"
                    style={{ background: `hsl(${form.primaryColorOverride})` }}
                  />
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Leave blank to use the theme's default. Format: <code>HUE SAT% LIGHT%</code>
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Hero</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label htmlFor="heroHeadline">Headline</Label>
              <Input
                id="heroHeadline"
                value={form.heroHeadline ?? ""}
                onChange={(e) => setForm({ ...form, heroHeadline: e.target.value || null })}
                data-testid="input-hero-headline"
              />
            </div>
            <div>
              <Label htmlFor="heroSub">Subheadline</Label>
              <Textarea
                id="heroSub"
                rows={2}
                value={form.heroSubheadline ?? ""}
                onChange={(e) =>
                  setForm({ ...form, heroSubheadline: e.target.value || null })
                }
                data-testid="input-hero-subheadline"
              />
            </div>
            <div>
              <Label>Hero image</Label>
              <div className="flex gap-3 items-start">
                {form.heroImageUrl ? (
                  <div
                    className="w-24 h-16 rounded border bg-cover bg-center shrink-0"
                    style={{ backgroundImage: `url(${form.heroImageUrl})` }}
                  />
                ) : (
                  <div className="w-24 h-16 rounded border border-dashed flex items-center justify-center bg-muted shrink-0">
                    <ImageIcon className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <div className="space-y-2 flex-1">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleHeroUpload(f);
                    }}
                    data-testid="input-hero-image"
                  />
                  {form.heroImageUrl ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setForm({ ...form, heroImageUrl: null })}
                    >
                      Remove
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">About & Contact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label htmlFor="about">About</Label>
              <Textarea
                id="about"
                rows={4}
                value={form.aboutText ?? ""}
                onChange={(e) => setForm({ ...form, aboutText: e.target.value || null })}
                data-testid="input-about"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Phone</Label>
                <Input
                  value={form.contactPhone ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, contactPhone: e.target.value || null })
                  }
                  data-testid="input-contact-phone"
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.contactEmail ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, contactEmail: e.target.value || null })
                  }
                  data-testid="input-contact-email"
                />
              </div>
            </div>
            <div>
              <Label>Address</Label>
              <Input
                value={form.contactAddress ?? ""}
                onChange={(e) =>
                  setForm({ ...form, contactAddress: e.target.value || null })
                }
                data-testid="input-contact-address"
              />
            </div>
            <div>
              <Label>Opening hours</Label>
              <Textarea
                rows={3}
                placeholder="Mon–Fri 8:00 – 17:00&#10;Sat 9:00 – 14:00&#10;Sun closed"
                value={form.openingHours ?? ""}
                onChange={(e) =>
                  setForm({ ...form, openingHours: e.target.value || null })
                }
                data-testid="input-opening-hours"
              />
            </div>
            <div>
              <Label>Inquiry email</Label>
              <Input
                type="email"
                placeholder="(defaults to contact email)"
                value={form.inquiryEmail ?? ""}
                onChange={(e) =>
                  setForm({ ...form, inquiryEmail: e.target.value || null })
                }
                data-testid="input-inquiry-email"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Visibility</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-sm">Publish site</div>
                <p className="text-xs text-muted-foreground">
                  When off, only you can preview. When on, the site is live at{" "}
                  <code>{publicUrl}</code>.
                </p>
              </div>
              <Switch
                checked={form.isPublished}
                onCheckedChange={(v) => setForm({ ...form, isPublished: v })}
                data-testid="switch-publish"
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-2 sticky bottom-0 bg-background/95 backdrop-blur py-3 -mx-1 px-1 border-t">
          <Button onClick={submit} disabled={save.isPending} data-testid="button-save-design">
            {save.isPending ? "Saving…" : "Save changes"}
          </Button>
          <Button variant="outline" onClick={() => site && setForm(site)}>
            Reset
          </Button>
        </div>
      </div>

      <div className="xl:col-span-3">
        <Card className="sticky top-4">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Live preview
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIframeKey((k) => k + 1)}
              data-testid="button-refresh-preview"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </CardHeader>
          <CardContent>
            <div
              className="rounded-md border overflow-hidden bg-muted"
              style={{ height: "calc(100vh - 240px)", minHeight: "560px" }}
            >
              <iframe
                key={iframeKey}
                ref={iframeRef}
                src={previewUrl}
                title="Cemetery site preview"
                className="w-full h-full bg-white"
                data-testid="preview-iframe"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              The preview uses your last saved data. Click "Save changes" then "Refresh" to see edits.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ---------- CATALOGUE TAB ----------

function CatalogueTab({ toast, stripeAvailable }: { toast: ToastFn; stripeAvailable: boolean }) {
  const qc = useQueryClient();
  const { data: categories = [] } = useQuery({
    queryKey: ["sb-categories", ORG_ID],
    queryFn: () => api<Category[]>(`/api/cemetery-categories?orgId=${ORG_ID}`),
  });
  const { data: products = [] } = useQuery({
    queryKey: ["sb-products", ORG_ID],
    queryFn: () => api<Product[]>(`/api/cemetery-products?orgId=${ORG_ID}`),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["sb-categories", ORG_ID] });
    qc.invalidateQueries({ queryKey: ["sb-products", ORG_ID] });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <div className="lg:col-span-1 space-y-3">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Tag className="h-4 w-4" />
                Categories
              </CardTitle>
              <CategoryDialog onDone={invalidate} toast={toast} />
            </div>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {categories.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">
                No categories yet. Add one to organize your products.
              </p>
            ) : (
              categories.map((c) => (
                <div
                  key={c.id}
                  data-testid={`row-category-${c.id}`}
                  className="flex items-center justify-between p-2 rounded hover:bg-muted/50 group"
                >
                  <div className="text-sm">
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-muted-foreground">{c.slug}</div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <CategoryDialog category={c} onDone={invalidate} toast={toast} />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => {
                        if (!confirm(`Delete category "${c.name}"?`)) return;
                        api(`/api/cemetery-categories/${c.id}?orgId=${ORG_ID}`, {
                          method: "DELETE",
                        })
                          .then(invalidate)
                          .catch((e) =>
                            toast({ title: "Delete failed", description: String(e), variant: "destructive" }),
                          );
                      }}
                      data-testid={`button-delete-category-${c.id}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="lg:col-span-3 space-y-3">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4" />
                Products & services
              </CardTitle>
              <ProductDialog
                categories={categories}
                onDone={invalidate}
                toast={toast}
                stripeAvailable={stripeAvailable}
              />
            </div>
          </CardHeader>
          <CardContent>
            {products.length === 0 ? (
              <div className="text-center py-12">
                <Package className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">
                  No products yet. Add your first item to start selling.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {products.map((p) => (
                  <div
                    key={p.id}
                    data-testid={`row-product-${p.id}`}
                    className="border rounded-lg p-3 flex gap-3"
                  >
                    <div
                      className="w-16 h-16 rounded shrink-0 bg-cover bg-center bg-muted"
                      style={
                        p.photos[0] ? { backgroundImage: `url(${p.photos[0]})` } : undefined
                      }
                    >
                      {!p.photos[0] ? (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageIcon className="h-5 w-5 text-muted-foreground/40" />
                        </div>
                      ) : null}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="font-medium text-sm truncate">{p.name}</div>
                        {p.isFeatured ? (
                          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                        ) : null}
                        {!p.isPublished ? (
                          <Badge variant="secondary" className="text-[10px] py-0">
                            Hidden
                          </Badge>
                        ) : null}
                      </div>
                      <div className="text-xs text-muted-foreground mb-1">
                        {p.type === "service" ? "Service" : "Product"} · ${p.price.toFixed(2)}
                      </div>
                      <div className="flex items-center gap-1">
                        <ProductDialog
                          product={p}
                          categories={categories}
                          onDone={invalidate}
                          toast={toast}
                          stripeAvailable={stripeAvailable}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => {
                            if (!confirm(`Delete "${p.name}"?`)) return;
                            api(`/api/cemetery-products/${p.id}?orgId=${ORG_ID}`, {
                              method: "DELETE",
                            })
                              .then(invalidate)
                              .catch((e) =>
                                toast({ title: "Delete failed", description: String(e), variant: "destructive" }),
                              );
                          }}
                          data-testid={`button-delete-product-${p.id}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function CategoryDialog({
  category,
  onDone,
  toast,
}: {
  category?: Category;
  onDone: () => void;
  toast: ToastFn;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: category?.name ?? "",
    slug: category?.slug ?? "",
    sortOrder: category?.sortOrder ?? 100,
  });

  useEffect(() => {
    if (open && category) {
      setForm({ name: category.name, slug: category.slug, sortOrder: category.sortOrder });
    }
    if (open && !category) {
      setForm({ name: "", slug: "", sortOrder: 100 });
    }
  }, [open, category]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        slug: form.slug || slugify(form.name),
        sortOrder: form.sortOrder,
      };
      if (category) {
        return api(`/api/cemetery-categories/${category.id}?orgId=${ORG_ID}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      }
      return api(`/api/cemetery-categories?orgId=${ORG_ID}`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      setOpen(false);
      onDone();
    },
    onError: (e) =>
      toast({ title: "Save failed", description: String(e), variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {category ? (
          <Button variant="ghost" size="icon" className="h-7 w-7" data-testid={`button-edit-category-${category.id}`}>
            <Edit className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button size="sm" data-testid="button-add-category">
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{category ? "Edit category" : "New category"}</DialogTitle>
          <DialogDescription>
            Group your products so visitors can filter the marketplace.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Name</Label>
            <Input
              value={form.name}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  name: e.target.value,
                  slug: f.slug || slugify(e.target.value),
                }))
              }
              data-testid="input-category-name"
            />
          </div>
          <div>
            <Label>Slug</Label>
            <Input
              value={form.slug}
              onChange={(e) =>
                setForm((f) => ({ ...f, slug: e.target.value.toLowerCase() }))
              }
              data-testid="input-category-slug"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => save.mutate()} disabled={!form.name || save.isPending} data-testid="button-save-category">
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProductDialog({
  product,
  categories,
  onDone,
  toast,
  stripeAvailable,
}: {
  product?: Product;
  categories: Category[];
  onDone: () => void;
  toast: ToastFn;
  stripeAvailable: boolean;
}) {
  const [open, setOpen] = useState(false);
  const blank = {
    name: "",
    slug: "",
    shortDescription: "",
    description: "",
    price: 0,
    compareAtPrice: null as number | null,
    type: "product" as "product" | "service",
    stockQuantity: null as number | null,
    categoryId: null as number | null,
    photos: [] as string[],
    isFeatured: false,
    isPublished: true,
    stripeEnabled: false,
    sortOrder: 100,
  };
  const [form, setForm] = useState(blank);

  useEffect(() => {
    if (open) {
      if (product) {
        setForm({
          name: product.name,
          slug: product.slug,
          shortDescription: product.shortDescription ?? "",
          description: product.description ?? "",
          price: product.price,
          compareAtPrice: product.compareAtPrice,
          type: product.type,
          stockQuantity: product.stockQuantity,
          categoryId: product.categoryId,
          photos: product.photos ?? [],
          isFeatured: product.isFeatured,
          isPublished: product.isPublished,
          stripeEnabled: product.stripeEnabled,
          sortOrder: product.sortOrder,
        });
      } else {
        setForm(blank);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, product]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        slug: form.slug || slugify(form.name),
        shortDescription: form.shortDescription || null,
        description: form.description || null,
        compareAtPrice: form.compareAtPrice || null,
        stockQuantity: form.type === "service" ? null : form.stockQuantity,
      };
      if (product) {
        return api(`/api/cemetery-products/${product.id}?orgId=${ORG_ID}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      }
      return api(`/api/cemetery-products?orgId=${ORG_ID}`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      setOpen(false);
      onDone();
    },
    onError: (e) =>
      toast({ title: "Save failed", description: String(e), variant: "destructive" }),
  });

  const handlePhotos = async (files: FileList) => {
    const remaining = 6 - form.photos.length;
    const toAdd = Array.from(files).slice(0, Math.max(0, remaining));
    const datas = await Promise.all(toAdd.map((f) => fileToDataUrl(f)));
    setForm((f) => ({ ...f, photos: [...f.photos, ...datas] }));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {product ? (
          <Button variant="ghost" size="icon" className="h-7 w-7" data-testid={`button-edit-product-${product.id}`}>
            <Edit className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button size="sm" data-testid="button-add-product">
            <Plus className="h-4 w-4 mr-1" />
            Add product
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product ? "Edit product" : "New product"}</DialogTitle>
          <DialogDescription>
            Add a product or service to your public marketplace.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Type</Label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm((f) => ({ ...f, type: v as "product" | "service" }))}
              >
                <SelectTrigger data-testid="select-product-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="product">Product</SelectItem>
                  <SelectItem value="service">Service</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Category</Label>
              <Select
                value={form.categoryId?.toString() ?? "none"}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, categoryId: v === "none" ? null : Number(v) }))
                }
              >
                <SelectTrigger data-testid="select-product-category">
                  <SelectValue placeholder="Uncategorized" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Uncategorized</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id.toString()}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Name</Label>
            <Input
              value={form.name}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  name: e.target.value,
                  slug: f.slug || slugify(e.target.value),
                }))
              }
              data-testid="input-product-name"
            />
          </div>
          <div>
            <Label>Slug</Label>
            <Input
              value={form.slug}
              onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value.toLowerCase() }))}
              data-testid="input-product-slug"
            />
          </div>
          <div>
            <Label>Short description</Label>
            <Input
              value={form.shortDescription}
              onChange={(e) => setForm((f) => ({ ...f, shortDescription: e.target.value }))}
              maxLength={300}
              data-testid="input-product-short"
            />
          </div>
          <div>
            <Label>Full description</Label>
            <Textarea
              rows={4}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              data-testid="input-product-desc"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Price ($)</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: Number(e.target.value) || 0 }))}
                data-testid="input-product-price"
              />
            </div>
            <div>
              <Label>Compare price</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={form.compareAtPrice ?? ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    compareAtPrice: e.target.value ? Number(e.target.value) : null,
                  }))
                }
                data-testid="input-product-compare"
              />
            </div>
            <div>
              <Label>Stock {form.type === "service" ? "(n/a)" : ""}</Label>
              <Input
                type="number"
                min={0}
                disabled={form.type === "service"}
                value={form.stockQuantity ?? ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    stockQuantity: e.target.value ? Number(e.target.value) : null,
                  }))
                }
                placeholder="Unlimited"
                data-testid="input-product-stock"
              />
            </div>
          </div>
          <div>
            <Label>Photos ({form.photos.length}/6)</Label>
            <div className="flex flex-wrap gap-2 mt-1.5">
              {form.photos.map((p, i) => (
                <div key={i} className="relative w-20 h-20 group">
                  <div
                    className="w-full h-full rounded border bg-cover bg-center"
                    style={{ backgroundImage: `url(${p})` }}
                  />
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, photos: f.photos.filter((_, j) => j !== i) }))}
                    className="absolute -top-1.5 -right-1.5 bg-destructive text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100"
                    aria-label="Remove photo"
                  >
                    ×
                  </button>
                </div>
              ))}
              {form.photos.length < 6 ? (
                <label className="w-20 h-20 border border-dashed rounded flex items-center justify-center cursor-pointer hover:border-primary text-muted-foreground hover:text-foreground">
                  <Plus className="h-5 w-5" />
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => e.target.files && handlePhotos(e.target.files)}
                    data-testid="input-product-photos"
                  />
                </label>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-4 pt-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Switch
                checked={form.isPublished}
                onCheckedChange={(v) => setForm((f) => ({ ...f, isPublished: v }))}
                data-testid="switch-product-published"
              />
              Visible on site
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Switch
                checked={form.isFeatured}
                onCheckedChange={(v) => setForm((f) => ({ ...f, isFeatured: v }))}
                data-testid="switch-product-featured"
              />
              Featured on home page
            </label>
            <label
              className="flex items-center gap-2 text-sm cursor-pointer"
              title={stripeAvailable ? "Stripe Checkout enabled" : "Stripe Connect not yet wired up — coming soon"}
            >
              <Switch
                checked={form.stripeEnabled}
                onCheckedChange={(v) => setForm((f) => ({ ...f, stripeEnabled: v }))}
                disabled={!stripeAvailable}
                data-testid="switch-product-stripe"
              />
              <CreditCard className="h-3.5 w-3.5" />
              Pay online
              {!stripeAvailable ? (
                <Badge variant="secondary" className="text-[10px] py-0 ml-1">
                  Coming soon
                </Badge>
              ) : null}
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => save.mutate()} disabled={!form.name || save.isPending} data-testid="button-save-product">
            {save.isPending ? "Saving…" : "Save product"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- ORDERS TAB ----------

const STATUS_LABELS: Record<Order["status"], string> = {
  new: "New",
  acknowledged: "Acknowledged",
  in_progress: "In progress",
  fulfilled: "Fulfilled",
  cancelled: "Cancelled",
};

const STATUS_COLORS: Record<Order["status"], string> = {
  new: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  acknowledged: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  in_progress: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  fulfilled: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  cancelled: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

function OrdersTab({ toast }: { toast: ToastFn }) {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Order["status"] | "all">("all");
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["sb-orders", ORG_ID, filter],
    queryFn: () =>
      api<Order[]>(
        `/api/cemetery-orders?orgId=${ORG_ID}${filter === "all" ? "" : `&status=${filter}`}`,
      ),
  });

  const update = useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: Partial<Order> }) =>
      api(`/api/cemetery-orders/${id}?orgId=${ORG_ID}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sb-orders", ORG_ID] }),
    onError: (e) =>
      toast({ title: "Update failed", description: String(e), variant: "destructive" }),
  });

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: orders.length };
    orders.forEach((o) => {
      c[o.status] = (c[o.status] ?? 0) + 1;
    });
    return c;
  }, [orders]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(["all", "new", "acknowledged", "in_progress", "fulfilled", "cancelled"] as const).map(
          (s) => (
            <Button
              key={s}
              variant={filter === s ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(s)}
              data-testid={`filter-${s}`}
            >
              {s === "all" ? "All" : STATUS_LABELS[s]}
              {counts[s] ? <span className="ml-2 opacity-70">{counts[s]}</span> : null}
            </Button>
          ),
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Loading orders…</p>
      ) : orders.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <ShoppingBag className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">
              No orders yet. When customers submit requests through your site, they'll appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <Card key={o.id} data-testid={`row-order-${o.id}`}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between flex-wrap gap-3 mb-3">
                  <div>
                    <div className="font-mono text-sm font-semibold">{o.orderNumber}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(o.createdAt).toLocaleString()} · ${o.total.toFixed(2)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={STATUS_COLORS[o.status]} variant="outline">
                      {STATUS_LABELS[o.status]}
                    </Badge>
                    <Select
                      value={o.status}
                      onValueChange={(v) =>
                        update.mutate({ id: o.id, patch: { status: v as Order["status"] } })
                      }
                    >
                      <SelectTrigger className="h-8 w-40" data-testid={`select-status-${o.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(STATUS_LABELS) as Order["status"][]).map((s) => (
                          <SelectItem key={s} value={s}>
                            {STATUS_LABELS[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                      Customer
                    </div>
                    <div className="font-medium">{o.customerName}</div>
                    <a
                      href={`mailto:${o.customerEmail}`}
                      className="text-xs text-primary hover:underline block"
                    >
                      {o.customerEmail}
                    </a>
                    {o.customerPhone ? (
                      <div className="text-xs text-muted-foreground">{o.customerPhone}</div>
                    ) : null}
                  </div>
                  <div className="md:col-span-2">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                      Items
                    </div>
                    <ul className="space-y-1">
                      {o.items.map((it, i) => (
                        <li key={i} className="flex justify-between text-sm">
                          <span>
                            {it.quantity} × {it.name}
                          </span>
                          <span className="font-mono">${it.lineTotal.toFixed(2)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                {o.customerNotes ? (
                  <div className="mt-3 pt-3 border-t">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                      Notes from customer
                    </div>
                    <p className="text-sm whitespace-pre-line">{o.customerNotes}</p>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
