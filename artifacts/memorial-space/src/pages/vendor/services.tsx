/**
 * Vendor service catalog — CRUD over `vendor_services`. Each service is a
 * public listing on the vendor's directory page. Photos are URLs (v1; we'll
 * wire object-storage uploads later).
 */
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Save, Loader2, Wrench, AlertCircle, ImagePlus, X, Repeat, Images } from "lucide-react";
import { ImageLightbox } from "@/components/image-lightbox";
import {
  useVendorServices,
  useCreateService,
  useUpdateService,
  useDeleteService,
  type VendorService,
  type PricingModel,
  type BillingCadence,
} from "./api";
import { FUNERAL_CATEGORIES, categoryLabel } from "./categories";

interface ServiceDraft {
  name: string;
  description: string;
  pricingModel: PricingModel;
  priceFrom: string;
  priceTo: string;
  priceAmount: string;
  billingCadence: BillingCadence;
  category: string;
  photos: string[];
  isPublished: boolean;
}

const emptyDraft: ServiceDraft = {
  name: "",
  description: "",
  pricingModel: "fixed",
  priceFrom: "",
  priceTo: "",
  priceAmount: "",
  billingCadence: "one-time",
  category: "",
  photos: [],
  isPublished: true,
};

const PRICING_MODELS: { key: PricingModel; label: string; hint: string }[] = [
  { key: "fixed", label: "Fixed price", hint: "One flat amount" },
  { key: "range", label: "Price range", hint: "Min – max" },
  { key: "subscription", label: "Subscription", hint: "Recurring billing" },
  { key: "quote", label: "On request", hint: "Custom quote" },
];

const CADENCES: { key: BillingCadence; label: string }[] = [
  { key: "one-time", label: "One-time" },
  { key: "monthly", label: "Monthly" },
  { key: "quarterly", label: "Quarterly" },
  { key: "yearly", label: "Yearly" },
];

export default function VendorServices() {
  const { data, isLoading } = useVendorServices();
  const create = useCreateService();
  const update = useUpdateService();
  const remove = useDeleteService();

  const [editingId, setEditingId] = useState<number | "new" | null>(null);
  const [draft, setDraft] = useState<ServiceDraft>(emptyDraft);
  const [error, setError] = useState<string | null>(null);
  const [photoInput, setPhotoInput] = useState("");
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const services = data?.services ?? [];

  const startNew = () => {
    setEditingId("new");
    setDraft(emptyDraft);
    setError(null);
    setPhotoInput("");
  };

  const startEdit = (s: VendorService) => {
    setEditingId(s.id);
    setDraft({
      name: s.name,
      description: s.description ?? "",
      pricingModel: s.pricingModel,
      priceFrom: s.priceFrom?.toString() ?? "",
      priceTo: s.priceTo?.toString() ?? "",
      priceAmount: s.priceAmount?.toString() ?? "",
      billingCadence: s.billingCadence,
      category: s.category ?? "",
      photos: s.photos ?? [],
      isPublished: s.isPublished,
    });
    setError(null);
    setPhotoInput("");
  };

  const cancel = () => { setEditingId(null); setDraft(emptyDraft); setError(null); setPhotoInput(""); };

  const addPhoto = () => {
    const trimmed = photoInput.trim();
    if (!trimmed) return;
    try { new URL(trimmed); } catch { setError("Photo must be a valid URL."); return; }
    setDraft((d) => ({ ...d, photos: [...d.photos, trimmed] }));
    setPhotoInput("");
    setError(null);
  };

  const removePhoto = (idx: number) => setDraft((d) => ({ ...d, photos: d.photos.filter((_, i) => i !== idx) }));

  const save = async () => {
    setError(null);
    if (!draft.name.trim()) { setError("Name is required."); return; }
    const priceFrom = draft.priceFrom.trim() === "" ? null : Number(draft.priceFrom);
    const priceTo = draft.priceTo.trim() === "" ? null : Number(draft.priceTo);
    const priceAmount = draft.priceAmount.trim() === "" ? null : Number(draft.priceAmount);
    if (priceFrom != null && !Number.isFinite(priceFrom)) { setError("Price From must be a number."); return; }
    if (priceTo != null && !Number.isFinite(priceTo)) { setError("Price To must be a number."); return; }
    if (priceAmount != null && !Number.isFinite(priceAmount)) { setError("Price must be a number."); return; }
    if (draft.pricingModel === "range" && priceFrom != null && priceTo != null && priceTo < priceFrom) {
      setError("Price To must be ≥ Price From.");
      return;
    }
    if ((draft.pricingModel === "fixed" || draft.pricingModel === "subscription") && priceAmount == null) {
      setError("Enter a price for this pricing model.");
      return;
    }
    const cadence: BillingCadence = draft.pricingModel === "subscription" ? draft.billingCadence : "one-time";
    const payload = {
      name: draft.name.trim(),
      description: draft.description.trim() || null,
      pricingModel: draft.pricingModel,
      priceFrom: draft.pricingModel === "range" ? priceFrom : null,
      priceTo: draft.pricingModel === "range" ? priceTo : null,
      priceAmount: draft.pricingModel === "fixed" || draft.pricingModel === "subscription" ? priceAmount : null,
      billingCadence: cadence,
      category: draft.category.trim() || null,
      photos: draft.photos,
      isPublished: draft.isPublished,
      sortOrder: 0,
    };
    try {
      if (editingId === "new") {
        await create.mutateAsync(payload);
      } else if (typeof editingId === "number") {
        await update.mutateAsync({ id: editingId, patch: payload });
      }
      cancel();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    }
  };

  const del = async (id: number) => {
    if (!confirm("Delete this service? This can't be undone.")) return;
    try { await remove.mutateAsync(id); if (editingId === id) cancel(); } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Services</h1>
          <p className="text-muted-foreground mt-1">The offerings families browse on your public page.</p>
        </div>
        <Button onClick={startNew} disabled={editingId === "new"} className="bg-primary hover:bg-primary/90 self-start" data-testid="button-add-service">
          <Plus className="h-4 w-4 mr-2" />Add service
        </Button>
      </div>

      {editingId !== null ? (
        <Card className="border-primary/30 bg-primary/[0.02]">
          <CardContent className="p-6 space-y-4" data-testid="service-form">
            <div className="flex items-center gap-2">
              <Wrench className="h-4 w-4 text-primary" />
              <h2 className="font-semibold">{editingId === "new" ? "New service" : "Edit service"}</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5 md:col-span-2">
                <Label>Name *</Label>
                <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Memorial bouquet" data-testid="input-service-name" />
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <select
                  value={draft.category}
                  onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  data-testid="select-service-category"
                >
                  <option value="">— Select category —</option>
                  {FUNERAL_CATEGORIES.map((c) => (
                    <option key={c.key} value={c.key}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Pricing model</Label>
                <div className="grid grid-cols-2 gap-1.5">
                  {PRICING_MODELS.map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => setDraft({ ...draft, pricingModel: p.key })}
                      data-testid={`pricing-model-${p.key}`}
                      className={`px-2.5 py-2 text-xs rounded-md border text-left transition-colors ${
                        draft.pricingModel === p.key
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border/60 hover:border-border"
                      }`}
                    >
                      <p className="font-medium">{p.label}</p>
                      <p className="text-[10px] text-muted-foreground">{p.hint}</p>
                    </button>
                  ))}
                </div>
              </div>
              {draft.pricingModel === "fixed" || draft.pricingModel === "subscription" ? (
                <div className="space-y-1.5">
                  <Label>Price ($)</Label>
                  <Input type="number" min={0} value={draft.priceAmount} onChange={(e) => setDraft({ ...draft, priceAmount: e.target.value })} placeholder="0" data-testid="input-service-price-amount" />
                </div>
              ) : null}
              {draft.pricingModel === "range" ? (
                <div className="space-y-1.5">
                  <Label>Price range</Label>
                  <div className="flex items-center gap-2">
                    <Input type="number" min={0} value={draft.priceFrom} onChange={(e) => setDraft({ ...draft, priceFrom: e.target.value })} placeholder="From" data-testid="input-service-price-from" />
                    <span className="text-muted-foreground">—</span>
                    <Input type="number" min={0} value={draft.priceTo} onChange={(e) => setDraft({ ...draft, priceTo: e.target.value })} placeholder="To" data-testid="input-service-price-to" />
                  </div>
                </div>
              ) : null}
              {draft.pricingModel === "subscription" ? (
                <div className="space-y-1.5">
                  <Label>Billing cadence</Label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {CADENCES.filter((c) => c.key !== "one-time").map((c) => (
                      <button
                        key={c.key}
                        type="button"
                        onClick={() => setDraft({ ...draft, billingCadence: c.key })}
                        data-testid={`cadence-${c.key}`}
                        className={`px-2 py-1.5 text-xs rounded-md border transition-colors ${
                          draft.billingCadence === c.key
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border/60 hover:border-border"
                        }`}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="space-y-1.5 md:col-span-2">
                <Label>Description</Label>
                <Textarea rows={3} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="What's included, lead times, customisation…" data-testid="input-service-description" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Photos (URLs)</Label>
              <div className="flex gap-2">
                <Input value={photoInput} onChange={(e) => setPhotoInput(e.target.value)} placeholder="https://…" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addPhoto(); } }} data-testid="input-photo-url" />
                <Button type="button" variant="outline" onClick={addPhoto}><ImagePlus className="h-4 w-4 mr-1.5" />Add</Button>
              </div>
              {draft.photos.length > 0 ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 pt-2">
                  {draft.photos.map((p, i) => (
                    <div key={i} className="relative group aspect-square rounded-md overflow-hidden border border-border/60 bg-muted/30">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p} alt="" className="h-full w-full object-cover" />
                      <button type="button" onClick={() => removePhoto(i)} className="absolute top-1 right-1 rounded-full bg-background/90 p-1 opacity-0 group-hover:opacity-100 transition" aria-label="Remove">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="flex items-center justify-between rounded-md border border-border/60 p-3">
              <div>
                <p className="text-sm font-medium">Show on public page</p>
                <p className="text-[11px] text-muted-foreground">Off = saved but hidden from families.</p>
              </div>
              <Switch checked={draft.isPublished} onCheckedChange={(v) => setDraft({ ...draft, isPublished: v })} data-testid="switch-service-published" />
            </div>

            {error ? (
              <div className="rounded-md border border-rose-500/40 bg-rose-500/10 text-rose-300 px-3 py-2 text-xs flex items-center gap-2">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" /> <span>{error}</span>
              </div>
            ) : null}

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={cancel}>Cancel</Button>
              <Button onClick={save} disabled={create.isPending || update.isPending} className="bg-primary hover:bg-primary/90" data-testid="button-save-service">
                {(create.isPending || update.isPending) ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</> : <><Save className="h-4 w-4 mr-2" />Save</>}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading services…</p>
      ) : services.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-10 text-center text-muted-foreground" data-testid="empty-services">
            <Wrench className="h-10 w-10 mx-auto opacity-40 mb-3" />
            <p className="font-medium">No services yet.</p>
            <p className="text-sm mt-1">Add your first service so families can request it.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map((s) => (
            <Card key={s.id} className="border-border/60 overflow-hidden" data-testid={`service-card-${s.id}`}>
              {s.photos[0] ? (
                <button
                  type="button"
                  className="relative group block w-full text-left p-0 border-0 bg-transparent"
                  onClick={() => { setLightboxImages(s.photos); setLightboxIndex(0); setLightboxOpen(true); }}
                  aria-label={`Open photo gallery for ${s.name} (${s.photos.length} images)`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.photos[0]} alt="" loading="lazy" decoding="async" className="h-32 w-full object-cover border-b border-border/40" />
                  {s.photos.length > 1 && (
                    <div className="absolute bottom-2 right-2 bg-black/50 text-white text-[11px] px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Images className="h-3 w-3" />
                      {s.photos.length}
                    </div>
                  )}
                </button>
              ) : (
                <div className="h-32 w-full bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center border-b border-border/40">
                  <Wrench className="h-8 w-8 text-primary/40" />
                </div>
              )}
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{s.name}</p>
                    {s.category ? <p className="text-xs text-muted-foreground">{categoryLabel(s.category)}</p> : null}
                  </div>
                  {s.isPublished ? (
                    <Badge variant="outline" className="text-[10px] border-emerald-400/40 text-emerald-300 bg-emerald-400/5 shrink-0">Live</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] border-muted-foreground/40 text-muted-foreground shrink-0">Hidden</Badge>
                  )}
                </div>
                {s.description ? <p className="text-sm text-muted-foreground line-clamp-2">{s.description}</p> : null}
                {s.pricingModel === "subscription" && s.priceAmount != null ? (
                  <p className="text-sm font-medium text-primary inline-flex items-center gap-1.5">
                    <Repeat className="h-3 w-3" />${s.priceAmount}
                    <span className="text-muted-foreground font-normal text-[11px]">/ {s.billingCadence}</span>
                  </p>
                ) : s.pricingModel === "fixed" && s.priceAmount != null ? (
                  <p className="text-sm font-medium text-primary">${s.priceAmount}</p>
                ) : s.pricingModel === "range" && (s.priceFrom != null || s.priceTo != null) ? (
                  <p className="text-sm font-medium text-primary">
                    {s.priceFrom != null && s.priceTo != null ? `$${s.priceFrom} – $${s.priceTo}`
                      : s.priceFrom != null ? `From $${s.priceFrom}` : `Up to $${s.priceTo}`}
                  </p>
                ) : s.pricingModel === "quote" ? (
                  <p className="text-sm font-medium text-muted-foreground italic">Custom quote</p>
                ) : null}
                <div className="flex items-center justify-end gap-1 pt-2 border-t border-border/40">
                  <Button size="sm" variant="ghost" onClick={() => startEdit(s)} data-testid={`button-edit-${s.id}`}>Edit</Button>
                  <Button size="sm" variant="ghost" className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10" onClick={() => del(s.id)} data-testid={`button-delete-${s.id}`}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ImageLightbox
        images={lightboxImages}
        open={lightboxOpen}
        initialIndex={lightboxIndex}
        onOpenChange={setLightboxOpen}
      />
    </div>
  );
}
