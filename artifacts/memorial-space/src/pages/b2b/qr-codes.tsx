import { useState } from "react";
import { useListQrCodes, useCreateQrCode, useListBurials, useListPlots, useListMemorials, useGetOrganization, getListQrCodesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { QrCode, Plus, Copy, Scan, Wand2, KeyRound } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");

const ORG_ID = 1;

function QrDisplay({ code }: { code: string }) {
  return (
    <div className="flex items-center justify-center p-4 bg-white rounded-lg w-24 h-24">
      <div className="grid grid-cols-7 gap-0.5 w-full h-full">
        {Array.from({ length: 49 }, (_, i) => {
          const corners = [0,1,2,3,4,5,6,7,13,14,20,21,27,28,34,35,41,42,43,44,45,46,47,48];
          const filled = corners.includes(i) || Math.random() > 0.5;
          return <div key={i} className={`rounded-sm ${filled ? 'bg-gray-900' : 'bg-transparent'}`} />;
        })}
      </div>
    </div>
  );
}

export default function QrCodes() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: qrCodes, isLoading } = useListQrCodes({ organizationId: ORG_ID });
  const { data: burials } = useListBurials({ organizationId: ORG_ID });
  const { data: plots } = useListPlots({ organizationId: ORG_ID });
  const { data: memorials } = useListMemorials({ organizationId: ORG_ID });
  const { data: org } = useGetOrganization(ORG_ID);
  const createQrCode = useCreateQrCode();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ burialId: "", plotId: "", memorialId: "" });
  const [bulking, setBulking] = useState(false);

  const handleBulkGenerate = async () => {
    setBulking(true);
    try {
      const res = await fetch(`${BASE}/api/qr-codes/bulk-generate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId: ORG_ID }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { created: number; alreadyCovered: number; total: number };
      queryClient.invalidateQueries({ queryKey: getListQrCodesQueryKey() });
      toast({
        title: data.created > 0 ? `Generated ${data.created} new QR codes` : "All burials already have QR codes",
        description: `${data.alreadyCovered + data.created} of ${data.total} burials are now covered.`,
      });
    } catch (err) {
      toast({
        title: "Bulk generation failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBulking(false);
    }
  };

  const handleCreate = () => {
    createQrCode.mutate(
      { data: { organizationId: ORG_ID, burialId: form.burialId ? Number(form.burialId) : undefined, plotId: form.plotId ? Number(form.plotId) : undefined, memorialId: form.memorialId ? Number(form.memorialId) : undefined } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListQrCodesQueryKey() });
          setOpen(false);
          setForm({ burialId: "", plotId: "", memorialId: "" });
          toast({ title: "QR Code generated", description: "New QR code has been created successfully." });
        },
      }
    );
  };

  const copyCode = (code: string) => {
    // Build the public memorial URL from the *current* origin and the org's
    // slug — never a hardcoded production domain. The previous version
    // copied `https://memorialspace.app/memorial/${code}` which (a) points
    // at a domain that may not exist in dev/preview, and (b) is missing
    // the `/c/:slug/` org prefix so even on the right host it would fall
    // through to a non-existent route. Mirror the same shape the API
    // encodes into the QR image itself (`/c/:slug/memorial/:code`).
    const slug = org?.slug;
    const url = slug
      ? `${window.location.origin}/c/${slug}/memorial/${code}`
      : `${window.location.origin}/c/_/memorial/${code}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Copied!", description: "Memorial URL copied to clipboard." });
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">QR Codes</h1>
          <p className="text-muted-foreground mt-1">Generate and manage QR codes linking to memorial pages.</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              try {
                const res = await fetch(`${BASE}/api/qr-codes/backfill-pins`, {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ organizationId: ORG_ID }),
                });
                if (!res.ok) throw new Error(await res.text());
                const data = (await res.json()) as { updated: number; total: number };
                queryClient.invalidateQueries({ queryKey: getListQrCodesQueryKey() });
                toast({
                  title: data.updated > 0 ? `Issued ${data.updated} edit PINs` : "Every QR already has a PIN",
                  description: `${data.total} QR codes total.`,
                });
              } catch (err) {
                toast({ title: "Couldn't issue PINs", description: err instanceof Error ? err.message : "Try again.", variant: "destructive" });
              }
            }}
            data-testid="button-issue-pins"
          >
            <KeyRound className="h-4 w-4 mr-2" />
            Issue missing PINs
          </Button>
          <Button
            variant="outline"
            onClick={handleBulkGenerate}
            disabled={bulking}
            data-testid="button-bulk-qr"
          >
            <Wand2 className="h-4 w-4 mr-2" />
            {bulking ? "Generating…" : "Generate for all burials"}
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-qr"><Plus className="h-4 w-4 mr-2" />Generate QR Code</Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Generate QR Code</DialogTitle><DialogDescription>Generate a QR code linking to a burial or memorial page.</DialogDescription></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Link to Burial (optional)</Label>
                <select className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.burialId} onChange={e => setForm(f => ({ ...f, burialId: e.target.value }))} data-testid="select-burial">
                  <option value="">None</option>
                  {burials?.map(b => <option key={b.id} value={b.id}>{b.deceasedName}</option>)}
                </select>
              </div>
              <div>
                <Label>Link to Plot (optional)</Label>
                <select className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.plotId} onChange={e => setForm(f => ({ ...f, plotId: e.target.value }))} data-testid="select-plot">
                  <option value="">None</option>
                  {plots?.map(p => <option key={p.id} value={p.id}>Plot {p.plotNumber} - {p.section}</option>)}
                </select>
              </div>
              <div>
                <Label>Link to Memorial Page (optional)</Label>
                <select className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.memorialId} onChange={e => setForm(f => ({ ...f, memorialId: e.target.value }))} data-testid="select-memorial">
                  <option value="">None</option>
                  {memorials?.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
                </select>
              </div>
              <Button onClick={handleCreate} disabled={createQrCode.isPending} className="w-full" data-testid="button-submit-qr">
                {createQrCode.isPending ? "Generating..." : "Generate QR Code"}
              </Button>
            </div>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{[1,2,3,4].map(i => <Card key={i} className="h-48 animate-pulse bg-muted" />)}</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {qrCodes?.map(qr => (
            <Card key={qr.id} className="hover:border-primary/40 transition-colors" data-testid={`card-qr-${qr.id}`}>
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <QrDisplay code={qr.code} />
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-sm font-bold tracking-widest text-primary mb-1">{qr.code}</div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
                      <Scan className="h-3 w-3" />{qr.scanCount ?? 0} scans
                    </div>
                    <Badge variant="outline" className="text-xs mb-2">Burial #{qr.burialId ?? "—"}</Badge>
                    {qr.editPin ? (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3" data-testid={`pin-${qr.id}`}>
                        <KeyRound className="h-3 w-3" />
                        Edit PIN: <span className="font-mono font-semibold tracking-widest text-foreground">{qr.editPin}</span>
                      </div>
                    ) : (
                      <div className="text-xs text-amber-600 mb-3">No PIN issued — families can't edit yet.</div>
                    )}
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => copyCode(qr.code)} className="flex-1" data-testid={`button-copy-qr-${qr.id}`}>
                        <Copy className="h-3 w-3 mr-1" />Copy Link
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {(!qrCodes || qrCodes.length === 0) && (
            <div className="col-span-3 text-center py-16 text-muted-foreground">
              <QrCode className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>No QR codes generated yet.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
