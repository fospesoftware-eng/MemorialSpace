/**
 * Public vendor detail page at `/vendors/:slug` — shows the vendor's profile,
 * full service catalog, and a request form that posts to
 * `POST /api/vendors/:slug/requests`. Anonymous: no login required for the
 * family to submit a request.
 */
import { useState, type FormEvent } from "react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, MapPin, Phone, Globe, Store, Wrench, CheckCircle2, AlertCircle, Loader2, Heart } from "lucide-react";
import { usePublicVendor, useSubmitVendorRequest } from "../vendor/api";
import { ImageLightbox } from "@/components/image-lightbox";

export default function VendorDetail({ slug }: { slug: string }) {
  const { data, isLoading, isError } = usePublicVendor(slug);
  const submit = useSubmitVendorRequest(slug);

  const [serviceId, setServiceId] = useState<number | undefined>(undefined);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deceasedName, setDeceasedName] = useState("");
  const [serviceLocation, setServiceLocation] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  if (isLoading) {
    return <div className="container mx-auto max-w-3xl px-6 py-20 text-sm text-muted-foreground">Loading vendor…</div>;
  }
  if (isError || !data) {
    return (
      <div className="container mx-auto max-w-2xl px-6 py-20 text-center">
        <h1 className="text-3xl font-bold mb-3">Vendor not found</h1>
        <p className="text-muted-foreground mb-6">This vendor may no longer be listed.</p>
        <Button asChild><Link href="/vendors"><ArrowLeft className="h-4 w-4 mr-2" />Back to directory</Link></Button>
      </div>
    );
  }

  const { vendor, services } = data;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (message.trim().length < 5) { setError("Please add a short message (5+ characters)."); return; }
    try {
      await submit.mutateAsync({
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim(),
        customerPhone: customerPhone.trim() || undefined,
        deceasedName: deceasedName.trim() || undefined,
        serviceLocation: serviceLocation.trim() || undefined,
        message: message.trim(),
        serviceId,
      });
      setSubmitted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submission failed");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/40 bg-card/30">
        <div className="container mx-auto max-w-5xl px-6 py-3">
          <Link href="/vendors" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to directory
          </Link>
        </div>
      </header>

      <main className="container mx-auto max-w-5xl px-6 py-10 space-y-8">
        <div className="flex flex-col md:flex-row md:items-start gap-6">
          {vendor.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={vendor.logoUrl} alt="" className="h-24 w-24 rounded-lg object-cover border border-border/40" />
          ) : (
            <div className="h-24 w-24 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Store className="h-12 w-12" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight" data-testid="vendor-name">{vendor.businessName}</h1>
            {vendor.categories.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {vendor.categories.map((c) => (
                  <Badge key={c} variant="secondary" className="capitalize text-[11px]">{c}</Badge>
                ))}
              </div>
            ) : null}
            {vendor.description ? <p className="text-muted-foreground mt-3 max-w-2xl">{vendor.description}</p> : null}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-4 text-sm text-muted-foreground">
              {vendor.serviceAreas.length > 0 ? (
                <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 shrink-0" />Serves: {vendor.serviceAreas.join(", ")}</div>
              ) : null}
              {vendor.contactPhone ? (
                <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 shrink-0" /><a href={`tel:${vendor.contactPhone}`} className="hover:underline">{vendor.contactPhone}</a></div>
              ) : null}
              {vendor.websiteUrl ? (
                <div className="flex items-center gap-2"><Globe className="h-3.5 w-3.5 shrink-0" /><a href={vendor.websiteUrl} target="_blank" rel="noreferrer" className="hover:underline truncate">{vendor.websiteUrl.replace(/^https?:\/\//, "")}</a></div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <section className="lg:col-span-3">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2"><Wrench className="h-5 w-5 text-primary" />Services</h2>
            {services.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="p-8 text-center text-muted-foreground text-sm">
                  This vendor hasn't published services yet. You can still send a general request →
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {services.map((s) => {
                  const selected = serviceId === s.id;
                  return (
                    <Card
                      key={s.id}
                      className={`border ${selected ? "border-primary bg-primary/5" : "border-border/60 hover:border-primary/30"} cursor-pointer transition-colors overflow-hidden`}
                      onClick={() => setServiceId(selected ? undefined : s.id)}
                      data-testid={`service-card-${s.id}`}
                    >
                      {/* Photo gallery strip */}
                      {s.photos.length > 0 && (
                        <div className="flex gap-1 p-2 pb-0 overflow-x-auto">
                          {s.photos.slice(0, 4).map((src, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setLightboxImages(s.photos);
                                setLightboxIndex(i);
                                setLightboxOpen(true);
                              }}
                              className="shrink-0 rounded-md overflow-hidden border border-border/40 hover:border-primary/50 transition-colors"
                              aria-label={`Open image ${i + 1} of ${s.photos.length} for ${s.name}`}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={src} alt={`${s.name} photo ${i + 1}`} loading="lazy" decoding="async" className="h-16 w-16 object-cover" />
                            </button>
                          ))}
                          {s.photos.length > 4 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setLightboxImages(s.photos);
                                setLightboxIndex(4);
                                setLightboxOpen(true);
                              }}
                              className="shrink-0 h-16 w-16 rounded-md bg-muted flex items-center justify-center text-xs text-muted-foreground border border-border/40 hover:border-primary/50 transition-colors"
                              aria-label={`Open gallery for ${s.name} (${s.photos.length} images)`}
                            >
                              +{s.photos.length - 4}
                            </button>
                          )}
                        </div>
                      )}
                      <CardContent className="p-4 flex gap-4">
                        {s.photos.length === 0 && (
                          <div className="h-14 w-14 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                            <Wrench className="h-6 w-6" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-semibold">{s.name}</p>
                            {s.priceFrom != null || s.priceTo != null ? (
                              <p className="text-sm font-medium text-primary shrink-0">
                                {s.priceFrom != null && s.priceTo != null ? `$${s.priceFrom}–$${s.priceTo}` : s.priceFrom != null ? `From $${s.priceFrom}` : `Up to $${s.priceTo}`}
                              </p>
                            ) : null}
                          </div>
                          {s.category ? <p className="text-xs text-muted-foreground">{s.category}</p> : null}
                          {s.description ? <p className="text-sm text-muted-foreground mt-1.5 line-clamp-2">{s.description}</p> : null}
                          {selected ? (
                            <Badge variant="outline" className="mt-2 text-[10px] border-primary/40 text-primary bg-primary/5">
                              <CheckCircle2 className="h-3 w-3 mr-1" />Selected
                            </Badge>
                          ) : null}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>

          <aside className="lg:col-span-2">
            <Card className="border-border/60 sticky top-6">
              <CardContent className="p-6 space-y-4" data-testid="request-form">
                {submitted ? (
                  <div className="text-center py-6 space-y-3" data-testid="request-success">
                    <div className="h-12 w-12 mx-auto rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                      <CheckCircle2 className="h-6 w-6" />
                    </div>
                    <h3 className="text-xl font-semibold">Request sent</h3>
                    <p className="text-sm text-muted-foreground">
                      {vendor.businessName} will reach out to <span className="text-foreground">{customerEmail}</span> directly.
                    </p>
                    <Button variant="outline" onClick={() => { setSubmitted(false); setMessage(""); }}>Send another request</Button>
                  </div>
                ) : (
                  <>
                    <div>
                      <h3 className="text-lg font-semibold flex items-center gap-2"><Heart className="h-4 w-4 text-primary" />Request a service</h3>
                      <p className="text-xs text-muted-foreground mt-1">No account needed. {vendor.businessName} responds directly.</p>
                    </div>
                    <form onSubmit={handleSubmit} className="space-y-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="cn">Your name *</Label>
                        <Input id="cn" required value={customerName} onChange={(e) => setCustomerName(e.target.value)} data-testid="input-customer-name" />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="ce">Your email *</Label>
                        <Input id="ce" type="email" required value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} data-testid="input-customer-email" />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="cp">Your phone</Label>
                        <Input id="cp" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} data-testid="input-customer-phone" />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="dn">In memory of (optional)</Label>
                        <Input id="dn" value={deceasedName} onChange={(e) => setDeceasedName(e.target.value)} placeholder="Eleanor Rose Thompson" data-testid="input-deceased" />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="sl">Service location (optional)</Label>
                        <Input id="sl" value={serviceLocation} onChange={(e) => setServiceLocation(e.target.value)} placeholder="Greenwood Memorial Park, Seattle" data-testid="input-location" />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="msg">Message *</Label>
                        <Textarea id="msg" rows={4} required minLength={5} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Tell the vendor what you need…" data-testid="input-message" />
                      </div>
                      {serviceId ? (
                        <p className="text-xs text-muted-foreground">
                          Requesting: <span className="text-foreground font-medium">{services.find((s) => s.id === serviceId)?.name}</span>
                        </p>
                      ) : null}
                      {error ? (
                        <div className="rounded-md border border-rose-500/40 bg-rose-500/10 text-rose-300 px-3 py-2 text-xs flex items-center gap-2">
                          <AlertCircle className="h-3.5 w-3.5 shrink-0" /> <span>{error}</span>
                        </div>
                      ) : null}
                      <Button type="submit" disabled={submit.isPending} className="w-full bg-primary hover:bg-primary/90" data-testid="button-submit-request">
                        {submit.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sending…</> : "Send request"}
                      </Button>
                    </form>
                  </>
                )}
              </CardContent>
            </Card>
          </aside>
        </div>
      </main>

      <ImageLightbox
        images={lightboxImages}
        open={lightboxOpen}
        initialIndex={lightboxIndex}
        onOpenChange={setLightboxOpen}
        title="Service photos"
      />
    </div>
  );
}
