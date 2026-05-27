// Helpers for parsing and embedding memorial video URLs. Currently
// YouTube-only (the most common ask from families); extending to Vimeo
// later just means adding a second matcher and embed builder.

// Extract the 11-character YouTube video ID from any of the common URL
// shapes families paste in. Returns null when nothing recognisable is
// found so callers can show a clear validation error instead of silently
// embedding a broken iframe.
export function parseYouTubeId(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // Bare 11-char video ID — accept it directly so power users can paste
  // just the ID from a URL bar.
  if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) return trimmed;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  // youtu.be/<id>
  if (host === "youtu.be") {
    const id = url.pathname.slice(1).split("/")[0] ?? "";
    return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  }
  if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
    // youtube.com/watch?v=<id>
    const v = url.searchParams.get("v");
    if (v && /^[A-Za-z0-9_-]{11}$/.test(v)) return v;
    // youtube.com/embed/<id>, /shorts/<id>, /v/<id>, /live/<id>
    const m = url.pathname.match(/^\/(?:embed|shorts|v|live)\/([A-Za-z0-9_-]{11})/);
    if (m) return m[1] ?? null;
  }
  return null;
}

// Build the privacy-enhanced embed URL. youtube-nocookie.com avoids
// dropping tracking cookies for visitors who only watch a single tribute
// video — appropriate for a memorial context.
export function youtubeEmbedUrl(id: string): string {
  return `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1`;
}

// Public thumbnail URL. `hqdefault` exists for every public video; the
// higher-res variants don't, so we use this to avoid 404s.
export function youtubeThumbnailUrl(id: string): string {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

// Convenience: validate that an arbitrary string is a recognised
// YouTube URL (or bare ID). Used by the edit form before persisting.
export function isYouTubeUrl(raw: string): boolean {
  return parseYouTubeId(raw) !== null;
}
