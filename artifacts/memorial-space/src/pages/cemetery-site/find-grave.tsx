import { useState } from "react";
import { Search, MapPin } from "lucide-react";
import { THEMES, isThemeKey, type ThemeKey } from "./themes";
import { usePublicGraveSearch, type PublicSite } from "./api";

type Props = { slug: string; site: PublicSite };

export function CemeterySiteFindGrave({ slug, site }: Props) {
  const themeKey: ThemeKey = isThemeKey(site.theme) ? site.theme : "classic-marble";
  const theme = THEMES[themeKey];
  const headingFont = { fontFamily: theme.fontHeading };
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const { data, isLoading, isError } = usePublicGraveSearch(slug, query);

  return (
    <div className="container mx-auto max-w-4xl px-4 sm:px-6 py-12 md:py-16">
      <div className="text-center mb-10">
        <div
          style={{ color: "hsl(var(--site-primary))" }}
          className="text-xs uppercase tracking-widest font-semibold mb-3"
        >
          Grave Locator
        </div>
        <h1 style={headingFont} className="text-4xl md:text-5xl font-semibold mb-4">
          Find a Loved One
        </h1>
        <p style={{ color: "hsl(var(--site-muted-fg))" }} className="text-lg max-w-xl mx-auto">
          Search by name to find a grave at {site.siteTitle}.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(input);
        }}
        style={{
          background: "hsl(var(--site-card))",
          border: "1px solid hsl(var(--site-border))",
          borderRadius: "var(--site-radius)",
        }}
        className="p-2 flex gap-2 shadow-sm mb-8"
      >
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
            style={{ color: "hsl(var(--site-muted-fg))" }}
          />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Enter a name (at least 2 characters)..."
            data-testid="input-grave-search"
            style={{
              background: "transparent",
              color: "hsl(var(--site-fg))",
              fontFamily: theme.fontBody,
            }}
            className="w-full h-11 pl-9 pr-3 outline-none"
            autoFocus
          />
        </div>
        <button
          type="submit"
          data-testid="button-grave-search"
          style={{
            background: "hsl(var(--site-primary))",
            color: "hsl(var(--site-primary-fg))",
            borderRadius: "var(--site-radius)",
          }}
          className="px-6 h-11 font-semibold hover:opacity-90 transition-opacity"
        >
          Search
        </button>
      </form>

      {query && isLoading ? (
        <p style={{ color: "hsl(var(--site-muted-fg))" }} className="text-center py-8">
          Searching…
        </p>
      ) : null}

      {isError ? (
        <p className="text-center py-8 text-red-600">
          Couldn't run the search right now. Please try again.
        </p>
      ) : null}

      {query && data && data.results.length === 0 ? (
        <div
          style={{
            background: "hsl(var(--site-card))",
            border: "1px solid hsl(var(--site-border))",
            borderRadius: "var(--site-radius)",
          }}
          className="p-12 text-center"
          data-testid="no-results"
        >
          <p style={{ color: "hsl(var(--site-muted-fg))" }}>
            No graves found for "{query}". Try a partial name or different spelling.
          </p>
        </div>
      ) : null}

      {data && data.results.length > 0 ? (
        <div className="space-y-3" data-testid="grave-results">
          <p style={{ color: "hsl(var(--site-muted-fg))" }} className="text-sm mb-3">
            {data.results.length} result{data.results.length === 1 ? "" : "s"} for "{query}"
          </p>
          {data.results.map((r) => (
            <div
              key={r.id}
              style={{
                background: "hsl(var(--site-card))",
                border: "1px solid hsl(var(--site-border))",
                borderRadius: "var(--site-radius)",
              }}
              className="p-5 flex gap-4 items-center hover:shadow-md transition-shadow"
              data-testid={`grave-result-${r.id}`}
            >
              <div
                style={{
                  background: r.photoUrl
                    ? `url(${r.photoUrl}) center/cover`
                    : "hsl(var(--site-muted))",
                  width: "64px",
                  height: "64px",
                  borderRadius: "var(--site-radius)",
                }}
                className="shrink-0 flex items-center justify-center"
              >
                {!r.photoUrl ? (
                  <span style={{ color: "hsl(var(--site-muted-fg))" }} className="text-xs">
                    No photo
                  </span>
                ) : null}
              </div>
              <div className="flex-1 min-w-0">
                <h3 style={{ fontFamily: theme.fontHeading }} className="text-lg font-semibold truncate">
                  {r.name}
                </h3>
                <div
                  style={{ color: "hsl(var(--site-muted-fg))" }}
                  className="text-sm flex items-center gap-3 flex-wrap mt-1"
                >
                  {r.bornYear || r.diedYear ? (
                    <span>
                      {r.bornYear ?? "?"} – {r.diedYear ?? "?"}
                    </span>
                  ) : null}
                  {r.religion ? <span>· {r.religion}</span> : null}
                </div>
                <div
                  className="text-sm flex items-center gap-1.5 mt-1.5"
                  style={{ color: "hsl(var(--site-primary))" }}
                >
                  <MapPin className="h-3.5 w-3.5" />
                  {r.plotLabel}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
