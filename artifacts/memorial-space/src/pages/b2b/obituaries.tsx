import { useState } from "react";
import { useListObituaries, useCreateObituary, useUpdateObituary, useDeleteObituary, getListObituariesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, FileText, Share2, Trash2 } from "lucide-react";
import { format } from "date-fns";

const ORG_ID = 1;

export default function Obituaries() {
  const queryClient = useQueryClient();
  const { data: obituaries, isLoading } = useListObituaries({ organizationId: ORG_ID });
  const createObituary = useCreateObituary();
  const updateObituary = useUpdateObituary();
  const deleteObituary = useDeleteObituary();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", content: "", photoUrl: "", isPublished: false });

  const handleCreate = () => {
    createObituary.mutate(
      { data: { organizationId: ORG_ID, title: form.title, content: form.content, photoUrl: form.photoUrl, isPublished: form.isPublished } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListObituariesQueryKey() });
          setOpen(false);
          setForm({ title: "", content: "", photoUrl: "", isPublished: false });
        },
      }
    );
  };

  const togglePublish = (id: number, current: boolean) => {
    const o = obituaries?.find((x) => x.id === id);
    if (!o) return;
    updateObituary.mutate(
      {
        id,
        data: {
          organizationId: o.organizationId,
          burialId: o.burialId ?? undefined,
          title: o.title,
          content: o.content,
          photoUrl: o.photoUrl ?? undefined,
          isPublished: !current,
        },
      },
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListObituariesQueryKey() }) }
    );
  };

  const handleDelete = (id: number) => {
    deleteObituary.mutate(
      { id },
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListObituariesQueryKey() }) }
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Obituaries</h1>
          <p className="text-muted-foreground mt-1">Publish and manage obituary announcements.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-obituary"><Plus className="h-4 w-4 mr-2" />New Obituary</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Write Obituary</DialogTitle><DialogDescription>Compose and publish an obituary announcement.</DialogDescription></DialogHeader>
            <div className="space-y-4">
              <div><Label>Title</Label><Input className="mt-1" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Name, Age, Brief Description" data-testid="input-obit-title" /></div>
              <div><Label>Content</Label><Textarea className="mt-1" value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} placeholder="Write the obituary..." rows={6} data-testid="input-obit-content" /></div>
              <div><Label>Photo URL (optional)</Label><Input className="mt-1" value={form.photoUrl} onChange={e => setForm(f => ({ ...f, photoUrl: e.target.value }))} placeholder="https://..." data-testid="input-obit-photo" /></div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="isPublished" checked={form.isPublished} onChange={e => setForm(f => ({ ...f, isPublished: e.target.checked }))} data-testid="checkbox-publish" />
                <Label htmlFor="isPublished">Publish immediately</Label>
              </div>
              <Button onClick={handleCreate} disabled={createObituary.isPending} className="w-full" data-testid="button-submit-obituary">
                {createObituary.isPending ? "Saving..." : "Save Obituary"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-4">{[1,2,3].map(i => <Card key={i} className="h-32 animate-pulse bg-muted" />)}</div>
      ) : (
        <div className="space-y-4">
          {obituaries?.map(obit => (
            <Card key={obit.id} className="hover:border-primary/30 transition-colors" data-testid={`card-obituary-${obit.id}`}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {obit.photoUrl && <img src={obit.photoUrl} alt="" className="h-10 w-10 rounded-full object-cover" />}
                    <div>
                      <CardTitle className="text-base">{obit.title}</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {obit.publishedAt ? `Published ${format(new Date(obit.publishedAt), "MMM d, yyyy")}` : "Draft"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={obit.isPublished ? "default" : "secondary"}>
                      {obit.isPublished ? "Published" : "Draft"}
                    </Badge>
                    <Button size="sm" variant="outline" onClick={() => togglePublish(obit.id, obit.isPublished)} data-testid={`button-toggle-obit-${obit.id}`}>
                      {obit.isPublished ? "Unpublish" : "Publish"}
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => handleDelete(obit.id)} data-testid={`button-delete-obit-${obit.id}`}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-2">{obit.content}</p>
                <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                  <Share2 className="h-3 w-3" />{obit.shareCount ?? 0} shares
                </div>
              </CardContent>
            </Card>
          ))}
          {(!obituaries || obituaries.length === 0) && (
            <div className="text-center py-16 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>No obituaries yet.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
