import { useState } from "react";
import { Search, MapPin, Calendar, Heart, ArrowRight } from "lucide-react";
import { THEMES, isThemeKey, type ThemeKey } from "./themes";
import { usePublicGraveSearch, type PublicSite } from "./api";

type Props = { slug: string; site: PublicSite };

export function CemeterySiteFindGrave({ slug, site }: Props) {
  const themeKey: ThemeKey = isThemeKey(site.theme) ? site.theme : "classic-marble";
  const theme = THEMES[themeKey];
  const headingFont = { fontFamily: theme.fontHeading };
  const bodyFont = { fontFamily: theme.fontBody };

  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const { data, isLoading, isError } = usePublicGraveSearch(slug, query);

  const results = data?.results ?? [];

  return (
    <div className="min-h-screen">
      {/* ── Hero search banner ── */}
      <div
        style={{
          background: "linear-gradient(to bottom, hsl(var(--site-primary) / 0.12), hsl(var(--site-bg) / 0))",
          borderBottom: "1px solid hsl(var(--site-border))",
        }}
        className="py-20 px-4"
      >
        <div className="max-w-2xl mx-auto text-center">
          <div
            style={{ color: "hsl(var(--site-primary))", ...bodyFont }}
            className="text-xs uppercase tracking-widest font-semibold mb-3"
          >
            Grave Locator
          </div>
          <h1
            style={{ color: "hsl(var(--site-fg))", ...headingFont }}
            className="text-4xl md:text-5xl font-semibold mb-4"
          >
            Find a Loved One
          </h1>
          <p
            style={{ color: "hsl(var(--site-muted-fg))", ...bodyFont }}
            className="text-lg max-w-xl mx-auto mb-8"
          >
            Search by name to find a grave at {site.siteTitle}.
          </p>

          <form
            onSubmit={(e) => { e.preventDefault(); setQuery(input.trim()); }}
            className="flex gap-3"
          >
            <div className="relative flex-1">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5"
                style={{ color: "hsl(var(--site-muted-fg))" }}
              />
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Search by name…"
                data-testid="input-grave-search"
                autoFocus
                style={{
                  background: "hsl(var(--site-card))",
                  border: "1px solid hsl(var(--site-border))",
                  borderRadius: "var(--site-radius)",
                  color: "hsl(var(--site-fg))",
                  ...bodyFont,
                  width: "100%",
                  height: "3rem",
                  paddingLeft: "2.5rem",
                  paddingRight: "0.75rem",
                  outline: "none",
                  fontSize: "1rem",
                }}
              />
            </div>
            <button
              type="submit"
              disabled={!input.trim()}
              data-testid="button-grave-search"
              style={{
                background: "hsl(var(--site-primary))",
                color: "hsl(var(--site-primary-fg))",
                borderRadius: "var(--site-radius)",
                height: "3rem",
                padding: "0 1.5rem",
                fontWeight: 600,
                fontSize: "1rem",
                opacity: !input.trim() ? 0.5 : 1,
                cursor: !input.trim() ? "not-allowed" : "pointer",
                transition: "opacity 0.15s",
                ...bodyFont,
              }}
            >
              Search
            </button>
          </form>
        </div>
      </div>

      {/* ── Results area ── */}
      <div className="max-w-3xl mx-auto px-4 py-12">

        {/* Empty state — no search yet */}
        {!query && (
          <div className="text-center py-16" style={{ color: "hsl(var(--site-muted-fg))" }}>
            <Search className="h-16 w-16 mx-auto mb-4 opacity-20" />
            <p style={bodyFont} className="text-lg">Enter a name above to search</p>
            <p style={bodyFont} className="text-sm mt-2">Search across all burial records at {site.siteTitle}</p>
          </div>
        )}

        {/* Loading skeletons */}
        {query && isLoading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  background: "hsl(var(--site-card))",
                  border: "1px solid hsl(var(--site-border))",
                  borderRadius: "var(--site-radius)",
                  height: "6rem",
                  animation: "pulse 1.5s infinite",
                  opacity: 0.6,
                }}
              />
            ))}
          </div>
        )}

        {/* Error */}
        {isError && (
          <p className="text-center py-8" style={{ color: "hsl(var(--site-muted-fg))", ...bodyFont }}>
            Couldn't run the search right now. Please try again.
          </p>
        )}

        {/* Results */}
        {query && !isLoading && data && (
          <>
            <p style={{ color: "hsl(var(--site-muted-fg))", ...bodyFont }} className="text-sm mb-4">
              {results.length} result{results.length !== 1 ? "s" : ""} for &ldquo;{query}&rdquo;
            </p>

            {/* No results */}
            {results.length === 0 && (
              <div
                style={{
                  background: "hsl(var(--site-card))",
                  border: "1px solid hsl(var(--site-border))",
                  borderRadius: "var(--site-radius)",
                }}
                className="p-12 text-center"
                data-testid="no-results"
              >
                <Search className="h-12 w-12 mx-auto mb-4 opacity-20" style={{ color: "hsl(var(--site-muted-fg))" }} />
                <p style={{ color: "hsl(var(--site-muted-fg))", ...bodyFont }}>
                  No results found for &ldquo;{query}&rdquo;
                </p>
                <p style={{ color: "hsl(var(--site-muted-fg))", ...bodyFont }} className="text-sm mt-1">
                  Try a partial name or different spelling.
                </p>
              </div>
            )}

            <div className="space-y-4" data-testid="grave-results">
              {results.map((r) => {
                const memorialHref = r.memorialCode ? `/c/${slug}/memorial/${r.memorialCode}` : null;
                const card = (
                  <div className="py-5 px-5 flex items-start gap-4">
                    {/* Avatar / photo */}
                    {r.photoUrl ? (
                      <img
                        src={r.photoUrl}
                        alt=""
                        style={{ borderRadius: "50%", width: "56px", height: "56px", objectFit: "cover", flexShrink: 0 }}
                      />
                    ) : (
                      <div
                        style={{
                          width: "56px",
                          height: "56px",
                          borderRadius: "50%",
                          background: "hsl(var(--site-primary) / 0.1)",
                          flexShrink: 0,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Heart className="h-6 w-6" style={{ color: "hsl(var(--site-primary) / 0.4)" }} />
                      </div>
                    )}

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h3
                        style={{ color: "hsl(var(--site-fg))", ...headingFont }}
                        className="text-lg font-semibold truncate"
                      >
                        {r.name}
                      </h3>
                      <div
                        style={{ color: "hsl(var(--site-muted-fg))", ...bodyFont }}
                        className="text-sm flex flex-wrap items-center gap-3 mt-1"
                      >
                        {(r.bornYear || r.diedYear) && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {r.bornYear ?? "?"} — {r.diedYear ?? "?"}
                          </span>
                        )}
                        {r.plotLabel && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" />
                            {r.plotLabel}
                          </span>
                        )}
                        {r.religion && <span>· {r.religion}</span>}
                      </div>
                    </div>

                    {/* View Memorial button */}
                    {memorialHref && (
                      <div
                        style={{
                          border: "1px solid hsl(var(--site-border))",
                          borderRadius: "var(--site-radius)",
                          padding: "0.375rem 0.875rem",
                          fontSize: "0.8125rem",
                          fontWeight: 500,
                          display: "flex",
                          alignItems: "center",
                          gap: "0.375rem",
                          color: "hsl(var(--site-fg))",
                          flexShrink: 0,
                          whiteSpace: "nowrap",
                          ...bodyFont,
                        }}
                      >
                        View Memorial
                        <ArrowRight className="h-3.5 w-3.5" />
                      </div>
                    )}
                  </div>
                );

                return memorialHref ? (
                  <a
                    key={r.id}
                    href={memorialHref}
                    style={{
                      background: "hsl(var(--site-card))",
                      border: "1px solid hsl(var(--site-border))",
                      borderRadius: "var(--site-radius)",
                      textDecoration: "none",
                      color: "inherit",
                      display: "block",
                      transition: "border-color 0.15s, box-shadow 0.15s",
                    }}
                    className="hover:shadow-md"
                    data-testid={`grave-result-${r.id}`}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = "hsl(var(--site-primary) / 0.5)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = "hsl(var(--site-border))";
                    }}
                  >
                    {card}
                  </a>
                ) : (
                  <div
                    key={r.id}
                    style={{
                      background: "hsl(var(--site-card))",
                      border: "1px solid hsl(var(--site-border))",
                      borderRadius: "var(--site-radius)",
                    }}
                    data-testid={`grave-result-${r.id}`}
                  >
                    {card}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
