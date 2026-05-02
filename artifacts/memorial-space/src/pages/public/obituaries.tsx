import { useListPublicObituaries } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Calendar, Share2 } from "lucide-react";
import { format } from "date-fns";

export default function PublicObituaries() {
  const { data: obituaries, isLoading } = useListPublicObituaries();

  return (
    <div className="max-w-3xl mx-auto px-4 py-12 space-y-8 animate-in fade-in duration-500">
      <div className="text-center">
        <h1 className="text-4xl font-bold">Obituaries</h1>
        <p className="text-muted-foreground mt-3 text-lg">In loving memory of those who have passed.</p>
      </div>

      {isLoading ? (
        <div className="space-y-6">{[1,2,3].map(i => <Card key={i} className="h-40 animate-pulse bg-muted" />)}</div>
      ) : (
        <div className="space-y-6">
          {obituaries?.map(obit => (
            <Card key={obit.id} className="hover:border-primary/40 transition-colors" data-testid={`card-obit-${obit.id}`}>
              <CardContent className="pt-6">
                <div className="flex gap-5">
                  {obit.photoUrl && (
                    <img src={obit.photoUrl} alt="" className="h-20 w-20 rounded-full object-cover shrink-0" />
                  )}
                  <div className="flex-1">
                    <h2 className="text-xl font-semibold leading-tight" data-testid={`text-obit-title-${obit.id}`}>{obit.title}</h2>
                    {obit.publishedAt && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {format(new Date(obit.publishedAt), "MMMM d, yyyy")}
                      </div>
                    )}
                    <p className="text-sm text-muted-foreground mt-3 leading-relaxed line-clamp-3">{obit.content}</p>
                    <div className="flex items-center gap-3 mt-4">
                      <Badge variant="outline" className="text-xs">
                        <Share2 className="h-3 w-3 mr-1" />{obit.shareCount ?? 0} shares
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {(!obituaries || obituaries.length === 0) && (
            <div className="text-center py-16 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>No obituaries published yet.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
