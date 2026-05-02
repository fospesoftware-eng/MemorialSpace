import { useState } from "react";
import { usePublicGraveSearch, getPublicGraveSearchQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, MapPin, Calendar, Heart, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";

export default function GraveSearch() {
  const [query, setQuery] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const { data: results, isLoading } = usePublicGraveSearch(
    { q: searchTerm },
    { query: { enabled: !!searchTerm, queryKey: getPublicGraveSearchQueryKey({ q: searchTerm }) } }
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchTerm(query.trim());
  };

  return (
    <div className="min-h-screen">
      {/* Hero search section */}
      <div className="bg-gradient-to-b from-sidebar to-background py-20 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-4xl font-bold text-sidebar-foreground mb-4">Find a Loved One</h1>
          <p className="text-sidebar-foreground/70 mb-8 text-lg">Search our records to locate burial sites and memorial pages.</p>
          <form onSubmit={handleSearch} className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                className="pl-10 h-12 text-base bg-background"
                placeholder="Search by name..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                data-testid="input-grave-search"
              />
            </div>
            <Button type="submit" size="lg" disabled={!query.trim()} data-testid="button-search">
              Search
            </Button>
          </form>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-12">
        {!searchTerm && (
          <div className="text-center text-muted-foreground py-12">
            <Search className="h-16 w-16 mx-auto mb-4 opacity-20" />
            <p className="text-lg">Enter a name above to search burial records</p>
            <p className="text-sm mt-2">Search across all cemeteries in our network</p>
          </div>
        )}

        {isLoading && (
          <div className="space-y-4">
            {[1,2,3].map(i => <Card key={i} className="h-24 animate-pulse bg-muted" />)}
          </div>
        )}

        {searchTerm && !isLoading && results && (
          <>
            <p className="text-sm text-muted-foreground mb-4" data-testid="text-result-count">
              {results.length} result{results.length !== 1 ? "s" : ""} for &ldquo;{searchTerm}&rdquo;
            </p>
            <div className="space-y-4">
              {results.map((result, idx) => (
                <Card key={idx} className="hover:border-primary/40 transition-colors" data-testid={`card-result-${idx}`}>
                  <CardContent className="py-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4">
                        {result.burial.photoUrl ? (
                          <img src={result.burial.photoUrl} alt="" className="h-14 w-14 rounded-full object-cover shrink-0" />
                        ) : (
                          <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <Heart className="h-6 w-6 text-primary/40" />
                          </div>
                        )}
                        <div>
                          <h3 className="font-semibold text-lg">{result.burial.deceasedName}</h3>
                          <div className="flex flex-wrap gap-3 mt-1 text-sm text-muted-foreground">
                            {result.burial.deceasedDob && result.burial.deceasedDod && (
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3.5 w-3.5" />
                                {format(new Date(result.burial.deceasedDob), "yyyy")} — {format(new Date(result.burial.deceasedDod), "yyyy")}
                              </span>
                            )}
                            {result.plot && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3.5 w-3.5" />
                                Plot {result.plot.plotNumber}, {result.plot.section}
                              </span>
                            )}
                          </div>
                          {result.organization && (
                            <Badge variant="outline" className="mt-2 text-xs">{result.organization.name}</Badge>
                          )}
                        </div>
                      </div>
                      {result.memorial && (
                        <Link href={`/memorial/${result.memorial.id}`}>
                          <Button variant="outline" size="sm" className="shrink-0" data-testid={`button-view-memorial-${idx}`}>
                            View Memorial <ArrowRight className="h-3.5 w-3.5 ml-1" />
                          </Button>
                        </Link>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
              {results.length === 0 && (
                <div className="text-center py-16 text-muted-foreground">
                  <Search className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>No results found for &ldquo;{searchTerm}&rdquo;</p>
                  <p className="text-sm mt-1">Try a different name or spelling.</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
