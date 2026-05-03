/**
 * Unified burial-spot detail card. The map-maker's SpotEditor (in
 * `pages/b2b/map-maker.tsx`) is the canonical layout for "what a burial
 * spot looks like" — this component renders the same details in
 * read-only form so the B2B Cemetery Map sheet and the public cemetery
 * site map stay visually and informationally consistent with it.
 *
 * Two variants:
 *  - `admin`  → full info (spot-type, name, dob/dod, age, headstone
 *               gallery, religion, burial date, lat/lon, notes)
 *  - `public` → visitor-friendly subset (spot-type, name, dob/dod, age,
 *               headstone gallery, memorial-page link). Lat/lon and
 *               internal notes are intentionally hidden.
 *
 * Theming: the public variant uses the cemetery-site `--site-*` CSS
 * variables; admin uses the regular sidebar/foreground tokens.
 */
import { Link } from "wouter";
import { ArrowRight, Calendar, FileText, ImageOff, MapPin, ScanLine } from "lucide-react";
import { SPOT_ICONS, FALLBACK_SPOT_TYPE, DEFAULT_SPOT_TYPES, type SpotType } from "@/lib/cemetery-config";

export type BurialDetailsData = {
  /** Full name of the deceased. */
  name: string;
  /** ISO date string (YYYY-MM-DD) or year-only string. */
  dob?: string | null;
  dod?: string | null;
  /** Optional spot-type id (matches map-maker SpotType). Falls back to "civilian". */
  spotTypeId?: string | null;
  /** Ordered list of headstone photo URLs. Falls back to `photoUrl` as a single item. */
  headstoneImages?: string[] | null;
  photoUrl?: string | null;
  /** Admin-only context. */
  religion?: string | null;
  burialDate?: string | null;
  notes?: string | null;
  lat?: number | null;
  lon?: number | null;
  /** Public memorial page code (public variant only). */
  memorialCode?: string | null;
};

export type BurialDetailsProps = {
  burial: BurialDetailsData;
  variant?: "admin" | "public";
  /**
   * For the public variant, the cemetery slug is needed to build the
   * memorial-page link. Ignored for admin.
   */
  siteSlug?: string;
  className?: string;
};

function fmtDate(value?: string | null): string | null {
  if (!value) return null;
  // Year-only inputs (e.g. "1942") format as just the year.
  if (/^\d{4}$/.test(value)) return value;
  const d = new Date(value);
  if (isNaN(d.valueOf())) return value;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function calcAge(dob?: string | null, dod?: string | null): number | null {
  if (!dob) return null;
  const start = new Date(dob);
  const end = dod ? new Date(dod) : new Date();
  if (isNaN(start.valueOf()) || isNaN(end.valueOf())) return null;
  let age = end.getFullYear() - start.getFullYear();
  const m = end.getMonth() - start.getMonth();
  if (m < 0 || (m === 0 && end.getDate() < start.getDate())) age--;
  return age >= 0 && age < 200 ? age : null;
}

function resolveSpotType(id?: string | null): SpotType {
  if (!id) return DEFAULT_SPOT_TYPES[0] ?? FALLBACK_SPOT_TYPE;
  return DEFAULT_SPOT_TYPES.find((t) => t.id === id) ?? FALLBACK_SPOT_TYPE;
}

export function BurialDetails({ burial, variant = "admin", siteSlug, className }: BurialDetailsProps) {
  const isPublic = variant === "public";
  const meta = resolveSpotType(burial.spotTypeId);
  const Icon = SPOT_ICONS[meta.icon] ?? SPOT_ICONS.circle;

  const dob = fmtDate(burial.dob);
  const dod = fmtDate(burial.dod);
  const buried = fmtDate(burial.burialDate);
  const age = calcAge(burial.dob, burial.dod);

  const images = (burial.headstoneImages && burial.headstoneImages.length > 0)
    ? burial.headstoneImages
    : burial.photoUrl
      ? [burial.photoUrl]
      : [];

  const adminCardStyle =
    "rounded-lg border border-sidebar-border bg-sidebar-accent/30 overflow-hidden";
  const publicCardStyle = "overflow-hidden";

  return (
    <div
      data-testid="burial-details"
      className={[isPublic ? publicCardStyle : adminCardStyle, className].filter(Boolean).join(" ")}
      style={
        isPublic
          ? {
              background: "hsl(var(--site-bg))",
              border: "1px solid hsl(var(--site-border))",
              borderRadius: "var(--site-radius)",
            }
          : undefined
      }
    >
      {/* ----- Spot-type badge + name (mirrors map-maker SpotEditor header) ----- */}
      <div className="flex items-center gap-2 p-3"
           style={isPublic ? { borderBottom: "1px solid hsl(var(--site-border))" } : undefined}>
        <div
          className="h-9 w-9 rounded-full flex items-center justify-center border-2 border-white shadow-sm shrink-0"
          style={{ background: meta.color }}
          aria-label={meta.name}
        >
          <Icon className="h-4 w-4 text-white" strokeWidth={2.5} />
        </div>
        <div className="min-w-0 flex-1">
          <div
            className="text-sm font-semibold truncate"
            style={isPublic ? { color: "hsl(var(--site-fg))" } : undefined}
            data-testid="burial-name"
          >
            {burial.name || "Unnamed burial"}
          </div>
          <div
            className="text-[11px] truncate"
            style={
              isPublic
                ? { color: "hsl(var(--site-muted-fg))" }
                : undefined
            }
          >
            <span className={isPublic ? "" : "text-sidebar-foreground/60"}>{meta.name}</span>
            {age != null && (
              <span className={isPublic ? "opacity-70" : "text-sidebar-foreground/50"}> · age {age}</span>
            )}
          </div>
        </div>
      </div>

      {/* ----- DOB/DOD ----- */}
      <div className={isPublic ? "px-4 py-2" : "px-3 py-2 border-t border-sidebar-border/60"}>
        <div className="flex items-center gap-1.5 text-[11px]"
             style={isPublic ? { color: "hsl(var(--site-muted-fg))" } : undefined}>
          <Calendar className={`h-3 w-3 shrink-0 ${isPublic ? "" : "text-sidebar-foreground/60"}`} />
          <span className={isPublic ? "" : "text-sidebar-foreground/80"}>
            <strong className={isPublic ? "" : "text-sidebar-foreground"}>
              {dob ?? "—"}
            </strong>
            <span className="mx-1">–</span>
            <strong className={isPublic ? "" : "text-sidebar-foreground"}>
              {dod ?? "—"}
            </strong>
          </span>
        </div>
      </div>

      {/* ----- Headstone gallery (max 3 visible thumbnails, badge for "+N more") ----- */}
      <div className={isPublic ? "px-4 pb-3" : "px-3 pb-3"}>
        <div className={`text-[10px] uppercase tracking-wider mb-1.5 font-semibold ${
          isPublic ? "" : "text-sidebar-foreground/50"
        }`} style={isPublic ? { color: "hsl(var(--site-muted-fg))" } : undefined}>
          Headstone photos
        </div>
        {images.length > 0 ? (
          <div className="grid grid-cols-3 gap-1.5" data-testid="headstone-gallery">
            {images.slice(0, 3).map((src, i) => (
              <div
                key={`${i}-${src.length}`}
                className="relative aspect-square rounded-md overflow-hidden border bg-muted"
                style={isPublic ? { borderColor: "hsl(var(--site-border))" } : { borderColor: "hsl(var(--sidebar-border))" }}
              >
                <img src={src} alt={`Headstone ${i + 1} of ${burial.name}`} className="w-full h-full object-cover" />
                {i === 2 && images.length > 3 && (
                  <div className="absolute inset-0 bg-black/55 text-white text-xs font-semibold flex items-center justify-center">
                    +{images.length - 3}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div
            className={`flex items-center gap-1.5 text-[11px] italic px-2 py-2 rounded-md ${
              isPublic ? "" : "text-sidebar-foreground/50 bg-sidebar-accent/20 border border-dashed border-sidebar-border"
            }`}
            style={
              isPublic
                ? {
                    color: "hsl(var(--site-muted-fg))",
                    border: "1px dashed hsl(var(--site-border))",
                  }
                : undefined
            }
          >
            <ImageOff className="h-3 w-3" />
            No headstone photos
          </div>
        )}
      </div>

      {/* ----- Admin-only: religion / burial date / lat-lon / notes ----- */}
      {!isPublic && (
        <>
          {(burial.religion || buried) && (
            <div className="px-3 pb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
              {buried && (
                <span className="text-sidebar-foreground/80">
                  Interred <strong className="text-sidebar-foreground">{buried}</strong>
                </span>
              )}
              {burial.religion && (
                <span className="rounded border border-sidebar-border bg-transparent px-1.5 py-0.5 capitalize text-sidebar-foreground/80">
                  {burial.religion}
                </span>
              )}
            </div>
          )}
          {(burial.lat != null || burial.lon != null) && (
            <div className="px-3 pb-2 flex items-center gap-1.5 text-[10px] text-sidebar-foreground/60">
              <MapPin className="h-2.5 w-2.5" />
              <span className="tabular-nums">
                {burial.lat != null ? burial.lat.toFixed(4) : "—"}, {burial.lon != null ? burial.lon.toFixed(4) : "—"}
              </span>
            </div>
          )}
          {burial.notes && (
            <div className="border-t border-sidebar-border/60 px-3 py-2">
              <div className="flex items-start gap-1.5 text-[11px]">
                <FileText className="h-3 w-3 mt-0.5 text-sidebar-foreground/60 shrink-0" />
                <p className="text-sidebar-foreground/80 whitespace-pre-line break-words">{burial.notes}</p>
              </div>
            </div>
          )}
        </>
      )}

      {/* ----- Public-only: memorial page link ----- */}
      {isPublic && (
        <div className="px-4 pb-4">
          {burial.memorialCode && siteSlug ? (
            <Link
              href={`/c/${siteSlug}/memorial/${burial.memorialCode}`}
              data-testid="memorial-link"
              style={{
                background: "hsl(var(--site-primary))",
                color: "hsl(var(--site-primary-fg))",
                borderRadius: "var(--site-radius)",
              }}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              <ScanLine className="h-4 w-4" />
              View memorial page
              <ArrowRight className="h-4 w-4" />
            </Link>
          ) : (
            <p
              className="text-xs italic"
              style={{ color: "hsl(var(--site-muted-fg))" }}
            >
              No memorial page set up for this plot yet.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
