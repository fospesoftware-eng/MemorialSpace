import { useState } from "react";
import { useParams } from "wouter";
import { useGetMemorial, useListTributes, useCreateTribute, getListTributesQueryKey, getGetMemorialQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Heart, Calendar, MessageSquare, User } from "lucide-react";
import { format } from "date-fns";

export default function PublicMemorial() {
  const { id } = useParams<{ id: string }>();
  const memorialId = Number(id);
  const queryClient = useQueryClient();

  const { data: memorial, isLoading } = useGetMemorial(memorialId, {
    query: { enabled: !!memorialId, queryKey: getGetMemorialQueryKey(memorialId) }
  });
  const { data: tributes } = useListTributes(memorialId, {
    query: { enabled: !!memorialId, queryKey: getListTributesQueryKey(memorialId) }
  });
  const createTribute = useCreateTribute();
  const [form, setForm] = useState({ authorName: "", authorEmail: "", message: "" });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createTribute.mutate(
      { id: memorialId, data: { authorName: form.authorName, authorEmail: form.authorEmail, message: form.message } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTributesQueryKey(memorialId) });
          setForm({ authorName: "", authorEmail: "", message: "" });
          setSubmitted(true);
          setTimeout(() => setSubmitted(false), 3000);
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 space-y-6">
        <div className="h-64 bg-muted rounded-xl animate-pulse" />
        <div className="h-8 bg-muted rounded w-1/2 animate-pulse" />
        <div className="h-32 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  if (!memorial) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center text-muted-foreground">
        <Heart className="h-16 w-16 mx-auto mb-4 opacity-20" />
        <h2 className="text-xl font-semibold">Memorial not found</h2>
        <p className="mt-2">This memorial page may have been removed or made private.</p>
      </div>
    );
  }

  const photos = Array.isArray(memorial.photos) ? memorial.photos as string[] : [];

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 space-y-12 animate-in fade-in duration-500">
      {/* Hero */}
      <div className="text-center space-y-4">
        {photos.length > 0 ? (
          <div className="flex justify-center gap-4 flex-wrap">
            {photos.slice(0, 3).map((photo, i) => (
              <img
                key={i}
                src={photo}
                alt=""
                className={`rounded-xl object-cover shadow-lg ${i === 0 ? "h-48 w-48 ring-4 ring-primary/30" : "h-32 w-32 opacity-80"}`}
              />
            ))}
          </div>
        ) : (
          <div className="h-32 w-32 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
            <Heart className="h-12 w-12 text-primary/40" />
          </div>
        )}
        <div>
          <h1 className="text-4xl font-bold tracking-tight mt-6" data-testid="text-memorial-title">{memorial.title}</h1>
          <div className="flex items-center justify-center gap-4 mt-3 text-muted-foreground text-sm">
            <span className="flex items-center gap-1"><Heart className="h-3.5 w-3.5 text-primary" />{memorial.viewCount ?? 0} visits</span>
            <span className="flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5 text-primary" />{tributes?.length ?? 0} tributes</span>
          </div>
        </div>
      </div>

      {/* Biography */}
      {memorial.biography && (
        <Card>
          <CardHeader><CardTitle>Biography</CardTitle></CardHeader>
          <CardContent>
            <p className="text-base leading-relaxed text-muted-foreground whitespace-pre-wrap" data-testid="text-biography">{memorial.biography}</p>
          </CardContent>
        </Card>
      )}

      {/* Additional photos */}
      {photos.length > 1 && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Photos</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {photos.map((photo, i) => (
              <img key={i} src={photo} alt="" className="rounded-lg object-cover w-full h-40 hover:opacity-90 transition-opacity" />
            ))}
          </div>
        </div>
      )}

      {/* Tributes */}
      <div>
        <h2 className="text-xl font-semibold mb-6">Tributes & Condolences</h2>
        <div className="space-y-4 mb-8">
          {tributes?.map(tribute => (
            <Card key={tribute.id} className="bg-sidebar/30" data-testid={`card-tribute-${tribute.id}`}>
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{tribute.authorName}</p>
                    <p className="text-xs text-muted-foreground mb-2">{format(new Date(tribute.createdAt), "MMMM d, yyyy")}</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">{tribute.message}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {(!tributes || tributes.length === 0) && (
            <p className="text-muted-foreground text-sm text-center py-6">Be the first to leave a tribute.</p>
          )}
        </div>

        {/* Leave a tribute form */}
        <Card>
          <CardHeader><CardTitle>Leave a Tribute</CardTitle></CardHeader>
          <CardContent>
            {submitted ? (
              <div className="text-center py-6 text-primary font-medium">
                <Heart className="h-8 w-8 mx-auto mb-2" />
                Your tribute has been shared. Thank you.
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Your Name</Label><Input className="mt-1" required value={form.authorName} onChange={e => setForm(f => ({ ...f, authorName: e.target.value }))} data-testid="input-tribute-name" /></div>
                  <div><Label>Email (optional)</Label><Input className="mt-1" type="email" value={form.authorEmail} onChange={e => setForm(f => ({ ...f, authorEmail: e.target.value }))} data-testid="input-tribute-email" /></div>
                </div>
                <div><Label>Your Message</Label><Textarea className="mt-1" required rows={4} value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} placeholder="Share a memory or words of condolence..." data-testid="input-tribute-message" /></div>
                <Button type="submit" disabled={createTribute.isPending} data-testid="button-submit-tribute">
                  {createTribute.isPending ? "Submitting..." : "Share Tribute"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
