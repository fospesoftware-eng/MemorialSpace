type PublishedSpot = {
  id?: string;
  temporaryId?: string;
  x?: number;
  y?: number;
  name?: string;
  dob?: string;
  dod?: string;
  spotTypeId?: string;
  notes?: string;
  lat?: number;
  lon?: number;
  imagePath?: string;
  imageFileName?: string;
  headstoneImages?: string[];
  veteranStatus?: string;
  reviewStatus?: string;
};

type PublishedMapDoc = {
  cemeteryId?: number | null;
  spots?: PublishedSpot[];
  imgHeight?: number;
  imgWidth?: number;
};

type PublishedMapPayload = {
  doc?: PublishedMapDoc;
};

type ApiPlot = {
  id: number;
  organizationId: number;
  plotNumber: string;
  section?: string | null;
  row?: string | null;
  status: "available" | "reserved" | "occupied" | "maintenance";
  type?: "standard" | "double" | "family" | "mausoleum" | "cremation" | null;
  price?: number | null;
  ownerName?: string | null;
  ownerContact?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  geoJson?: string | null;
  notes?: string | null;
};

type ApiBurial = {
  id: number;
  plotId: number;
  organizationId: number;
  deceasedName: string;
  deceasedDob?: string | null;
  deceasedDod?: string | null;
  burialDate?: string | null;
  religion?: string | null;
  notes?: string | null;
  photoUrl?: string | null;
};

const SYNC_MARKER = "Map Maker published spot";
const SECTION_SIZE = 24;

function gridLetter(index: number) {
  let n = index;
  let out = "";
  do {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
}

function gridAssignment(spot: PublishedSpot, index: number, sortedSpots: PublishedSpot[]) {
  const byY = sortedSpots
    .filter((item) => typeof item.y === "number")
    .sort((a, b) => (a.y ?? 0) - (b.y ?? 0) || (a.x ?? 0) - (b.x ?? 0));

  const sortedIndex = byY.indexOf(spot);
  const safeIndex = sortedIndex >= 0 ? sortedIndex : index;
  const sectionIndex = Math.floor(safeIndex / SECTION_SIZE);
  const section = `Grid ${gridLetter(sectionIndex)}`;
  const number = String((safeIndex % SECTION_SIZE) + 1).padStart(3, "0");

  return {
    section,
    row: gridLetter(sectionIndex),
    plotNumber: `${gridLetter(sectionIndex)}-${number}`,
  };
}

function markerFor(spot: PublishedSpot) {
  return `${SYNC_MARKER}: ${spot.id || spot.temporaryId || "unknown"}`;
}

function compactNotes(parts: Array<string | undefined | null>) {
  return parts.filter((part): part is string => Boolean(part && part.trim())).join("\n");
}

function firstImage(spot: PublishedSpot) {
  return spot.headstoneImages?.[0] || spot.imagePath || null;
}

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await window.fetch(url, {
    credentials: "include",
    ...init,
    headers: {
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(body?.error || `Request failed (${res.status})`);
  }
  return body as T;
}

async function syncPublishedMapToOperations(payload: PublishedMapPayload, cemeteryId: number) {
  const doc = payload.doc;
  const spots = Array.isArray(doc?.spots) ? doc.spots : [];
  if (!cemeteryId || spots.length === 0) return;

  const existingPlots = await jsonFetch<ApiPlot[]>(`/api/plots?organizationId=${cemeteryId}`);
  const existingBurials = await jsonFetch<ApiBurial[]>(`/api/burials?organizationId=${cemeteryId}`);
  const plotByMarker = new Map<string, ApiPlot>();
  const plotByNumber = new Map<string, ApiPlot>();

  for (const plot of existingPlots) {
    const notes = plot.notes || "";
    const markerLine = notes.split("\n").find((line) => line.startsWith(SYNC_MARKER));
    if (markerLine) plotByMarker.set(markerLine, plot);
    plotByNumber.set(plot.plotNumber, plot);
  }

  const sortedSpots = [...spots].sort((a, b) => (a.y ?? 0) - (b.y ?? 0) || (a.x ?? 0) - (b.x ?? 0));

  for (const [index, spot] of spots.entries()) {
    const marker = markerFor(spot);
    const grid = gridAssignment(spot, index, sortedSpots);
    const status = spot.name ? "occupied" : "available";
    const notes = compactNotes([
      marker,
      spot.notes,
      spot.temporaryId ? `Temporary ID: ${spot.temporaryId}` : null,
      spot.imageFileName ? `Headstone image: ${spot.imageFileName}` : null,
      spot.veteranStatus ? `Veteran status: ${spot.veteranStatus}` : null,
      spot.reviewStatus ? `Review status: ${spot.reviewStatus}` : null,
    ]);

    const plotBody = {
      organizationId: cemeteryId,
      plotNumber: grid.plotNumber,
      section: grid.section,
      row: grid.row,
      status,
      type: "standard",
      latitude: spot.lat,
      longitude: spot.lon,
      geoJson: JSON.stringify({
        type: "Point",
        coordinates: [spot.x ?? null, spot.y ?? null],
        properties: {
          source: "map-maker-published-map",
          spotId: spot.id,
          temporaryId: spot.temporaryId,
        },
      }),
      notes,
    };

    const existing = plotByMarker.get(marker) || plotByNumber.get(grid.plotNumber);
    const plot = existing
      ? await jsonFetch<ApiPlot>(`/api/plots/${existing.id}`, {
          method: "PUT",
          body: JSON.stringify(plotBody),
        })
      : await jsonFetch<ApiPlot>("/api/plots", {
          method: "POST",
          body: JSON.stringify(plotBody),
        });

    if (spot.name?.trim()) {
      const alreadyLinked = existingBurials.some((burial) => {
        return burial.plotId === plot.id
          && burial.deceasedName.trim().toLowerCase() === spot.name!.trim().toLowerCase()
          && (burial.deceasedDob || "") === (spot.dob || "")
          && (burial.deceasedDod || "") === (spot.dod || "");
      });

      if (!alreadyLinked) {
        await jsonFetch<ApiBurial>("/api/burials", {
          method: "POST",
          body: JSON.stringify({
            plotId: plot.id,
            organizationId: cemeteryId,
            deceasedName: spot.name,
            deceasedDob: spot.dob,
            deceasedDod: spot.dod,
            notes: compactNotes([
              spot.notes,
              marker,
              spot.temporaryId ? `Imported from map spot ${spot.temporaryId}` : null,
            ]),
            photoUrl: firstImage(spot),
          }),
        });
      }
    }
  }

  window.dispatchEvent(new CustomEvent("memorialspace:published-map-synced", {
    detail: { cemeteryId, spots: spots.length },
  }));
}

function getPublishBody(input: RequestInfo | URL, init?: RequestInit): string | null {
  if (typeof init?.body === "string") return init.body;
  if (init?.body instanceof Blob || init?.body instanceof FormData) return null;
  if (input instanceof Request) return null;
  return null;
}

function getUrl(input: RequestInfo | URL) {
  return input instanceof Request ? input.url : String(input);
}

function getMethod(input: RequestInfo | URL, init?: RequestInit) {
  return (init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
}

function getCemeteryIdFromUrl(url: string) {
  try {
    const parsed = new URL(url, window.location.origin);
    const value = parsed.searchParams.get("cemeteryId");
    const id = value ? Number(value) : NaN;
    return Number.isFinite(id) ? id : null;
  } catch {
    return null;
  }
}

export function installMapMakerPublishSync() {
  if (typeof window === "undefined") return;
  const win = window as Window & { __memorialspaceMapPublishSyncInstalled?: boolean };
  if (win.__memorialspaceMapPublishSyncInstalled) return;
  win.__memorialspaceMapPublishSyncInstalled = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = getUrl(input);
    const method = getMethod(input, init);
    const isPublish = method === "POST" && url.includes("/api/cemetery-maps/publish");
    const bodyText = isPublish ? getPublishBody(input, init) : null;
    const cemeteryId = isPublish ? getCemeteryIdFromUrl(url) : null;

    const response = await originalFetch(input, init);

    if (isPublish && response.ok && bodyText && cemeteryId) {
      try {
        const payload = JSON.parse(bodyText) as PublishedMapPayload;
        void syncPublishedMapToOperations(payload, cemeteryId).catch((err) => {
          console.error("Failed to sync published map to burial spots", err);
        });
      } catch (err) {
        console.error("Failed to read published map payload for burial spot sync", err);
      }
    }

    return response;
  };
}
