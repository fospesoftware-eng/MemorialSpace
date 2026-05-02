import { useState } from "react";
import { useListMemorials, useCreateMemorial, useUpdateMemorial, useListBurials, getListMemorialsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Eye, Plus, Heart, Globe, Lock } from "lucide-react";

const ORG_ID = 1;

export default function Memorials() {
  const queryClient = useQueryClient();
  const { data: memorials, isLoading } = useListMemorials({ organizationId: ORG_ID });
  const { data: burials } = useListBurials({ organizationId: ORG_ID });
  const createMemorial = useCreateMemorial();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ burialId: "", title: "", biography: "", isPublic: true });

  const handleCreate = () => {
    createMemorial.mutate(
      { data: { burialId: Number(form.burialId), organizationId: ORG_ID, title: form.title, biography: form.biography, isPublic: form.isPublic } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListMemorialsQueryKey() });
          setOpen(false);
          setForm({ burialId: "", title: "", biography: "", isPublic: true });
        },
      }
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Memorial Pages</h1>
          <p className="text-muted-foreground mt-1">Manage digital memorial pages for the deceased.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-memorial"><Plus className="h-4 w-4 mr-2" />New Memorial</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Memorial Page</DialogTitle><DialogDescription>Create a digital memorial page to honor a loved one.</DialogDescription></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Burial Record</Label>
                <select className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.burialId} onChange={e => setForm(f => ({ ...f, burialId: e.target.value }))} data-testid="select-burial">
                  <option value="">Select burial...</option>
                  {burials?.map(b => <option key={b.id} value={b.id}>{b.deceasedName}</option>)}
                </select>
              </div>
              <div><Label>Title</Label><Input className="mt-1" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="In Memory of..." data-testid="input-title" /></div>
              <div><Label>Biography</Label><Textarea className="mt-1" value={form.biography} onChange={e => setForm(f => ({ ...f, biography: e.target.value }))} placeholder="Share their story..." rows={4} data-testid="input-biography" /></div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="isPublic" checked={form.isPublic} onChange={e => setForm(f => ({ ...f, isPublic: e.target.checked }))} data-testid="checkbox-public" />
                <Label htmlFor="isPublic">Make this page public</Label>
              </div>
              <Button onClick={handleCreate} disabled={createMemorial.isPending} className="w-full" data-testid="button-submit-memorial">
                {createMemorial.isPending ? "Creating..." : "Create Memorial"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1,2,3].map(i => <Card key={i} className="h-48 animate-pulse bg-muted" />)}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {memorials?.map(memorial => (
            <Card key={memorial.id} className="hover:border-primary/50 transition-colors" data-testid={`card-memorial-${memorial.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base leading-tight">{memorial.title}</CardTitle>
                  <Badge variant={memorial.isPublic ? "default" : "secondary"} className="ml-2 shrink-0">
                    {memorial.isPublic ? <><Globe className="h-3 w-3 mr-1" />Public</> : <><Lock className="h-3 w-3 mr-1" />Private</>}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-3">{memorial.biography || "No biography yet."}</p>
                <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{memorial.viewCount ?? 0} views</span>
                  <span className="flex items-center gap-1"><Heart className="h-3 w-3" />{(memorial.photos as string[] | null)?.length ?? 0} photos</span>
                </div>
              </CardContent>
            </Card>
          ))}
          {(!memorials || memorials.length === 0) && (
            <div className="col-span-3 text-center py-16 text-muted-foreground">
              <Heart className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>No memorial pages yet. Create one to honor the departed.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
