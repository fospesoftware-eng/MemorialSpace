import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, ImagePlus, Trash2, Save, CheckCircle2, KeyRound, Globe, Eye, Lock, Video } from "lucide-react";
import { THEMES, isThemeKey, type ThemeKey } from "./themes";
import { usePublicMemorial, useUpdatePublicMemorial, type MemorialVisibility, type PublicSite } from "./api";
import { parseYouTubeId, youtubeThumbnailUrl } from "./video-helpers";

type Props = { slug: string; site: PublicSite; code: string };

export function CemeterySiteMemorialEdit({ slug, site, code }: Props) {
  const themeKey: ThemeKey = isThemeKey(site.theme) ? site.theme : "classic-marble";
  const theme = THEMES[themeKey];
  const headingFont = { fontFamily: theme.fontHeading };

  const [editPin, setEditPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);

  // We thread the typed PIN into the GET so private/basic memorials can
  // load their real content for editing. Without this, a family editing a
  // private memorial would see an empty form because the API stripped the
  // bio/photos to enforce the gate. The PIN goes via header (never URL).
  const { data: memorial, isLoading, isError, error } = usePublicMemorial(slug, code, editPin.trim() || undefined);
  const memorialErrStatus = (error as Error & { status?: number } | undefined)?.status;
  const update = useUpdatePublicMemorial(slug, code);

  const [title, setTitle] = useState("");
  const [biography, setBiography] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [videos, setVideos] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<MemorialVisibility>("open");
  const [photoInput, setPhotoInput] = useState("");
  const [videoInput, setVideoInput] = useState("");
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);

  // Hydrate the form once the memorial data arrives in an *unlocked* state.
  // For a private memorial that means after the family types the PIN; for
  // an open memorial the very first response is unlocked. We deliberately
  // only hydrate once so a refetch (e.g. tab focus) doesn't clobber edits.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (memorial && !memorial.locked && !hydrated) {
      setTitle(memorial.title ?? memorial.deceasedName ?? "");
      setBiography(memorial.biography ?? "");
      setPhotos(memorial.photos ?? []);
      setVideos(memorial.videos ?? []);
      setVisibility(memorial.visibility);
      setHydrated(true);
    }
  }, [memorial, hydrated]);

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-2xl px-4 sm:px-6 py-20 text-center">
        <p style={{ color: "hsl(var(--site-muted-fg))" }}>Loading…</p>
      </div>
    );
  }

  if (isError || !memorial) {
    const tooMany = memorialErrStatus === 429;
    return (
      <div className="container mx-auto max-w-2xl px-4 sm:px-6 py-20 text-center">
        <h1 style={headingFont} className="text-3xl font-semibold mb-3">
          {tooMany ? "Too many PIN attempts" : "Memorial not found"}
        </h1>
        {tooMany ? (
          <p className="text-sm mb-6" style={{ color: "hsl(var(--site-muted-fg))" }}>
            We've paused PIN attempts on this memorial for a few minutes. Please try again shortly.
          </p>
        ) : null}
        <Link
          href={`/find-grave`}
          style={{ color: "hsl(var(--site-primary))" }}
          className="text-sm font-semibold"
        >
          Search for a grave
        </Link>
      </div>
    );
  }

  // The form needs the real memorial content to hydrate safely. While the
  // memorial is still locked (private memorial without a correct PIN, or
  // a basic memorial whose family wants to edit the gated bio), only show
  // the PIN entry — saving an empty form would otherwise nuke the bio and
  // photos. Once the PIN is correct the GET refetches with `locked: false`
  // and the full form renders below.
  const stillLocked = memorial.locked;

  const addPhoto = () => {
    setPhotoError(null);
    const trimmed = photoInput.trim();
    if (!trimmed) return;
    try {
      const u = new URL(trimmed);
      if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("bad protocol");
    } catch {
      setPhotoError("Please paste a full image URL starting with https://");
      return;
    }
    if (photos.includes(trimmed)) {
      setPhotoError("That photo is already in the gallery.");
      return;
    }
    if (photos.length >= 20) {
      setPhotoError("You can include up to 20 photos per memorial.");
      return;
    }
    setPhotos([...photos, trimmed]);
    setPhotoInput("");
  };

  const removePhoto = (idx: number) => {
    setPhotos(photos.filter((_, i) => i !== idx));
  };

  // Add a YouTube video. We validate up-front (rather than relying on the
  // server's generic URL check) so families get an immediate, specific
  // error instead of a confusing 400 after submit. We also de-dupe by
  // YouTube video ID, so pasting the same video as both `youtu.be/X` and
  // `youtube.com/watch?v=X` doesn't create two cards.
  const addVideo = () => {
    setVideoError(null);
    const trimmed = videoInput.trim();
    if (!trimmed) return;
    const id = parseYouTubeId(trimmed);
    if (!id) {
      setVideoError("Please paste a YouTube video link (e.g. https://youtu.be/… or youtube.com/watch?v=…).");
      return;
    }
    const already = videos.some((u) => parseYouTubeId(u) === id);
    if (already) {
      setVideoError("That video is already in the gallery.");
      return;
    }
    if (videos.length >= 10) {
      setVideoError("You can include up to 10 videos per memorial.");
      return;
    }
    setVideos([...videos, trimmed]);
    setVideoInput("");
  };

  const removeVideo = (idx: number) => {
    setVideos(videos.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    setSavedAt(null);
    setPinError(null);
    if (!editPin.trim()) {
      setPinError("Please enter the 6-digit edit PIN issued by the cemetery.");
      return;
    }
    try {
      await update.mutateAsync({
        editPin: editPin.trim(),
        title: title.trim() || memorial.deceasedName || "Memorial",
        biography: biography.trim() || null,
        photos,
        videos,
        visibility,
      });
      setSavedAt(Date.now());
    } catch (err) {
      const status = (err as Error & { status?: number }).status;
      if (status === 401) {
        setPinError("That PIN doesn't match. Double-check the PIN issued by the cemetery.");
      } else if (status === 409) {
        setPinError("This memorial doesn't have an edit PIN yet — please contact the cemetery.");
      } else {
        setPinError(null);
      }
    }
  };

  return (
    <div className="container mx-auto max-w-2xl px-4 sm:px-6 py-10 md:py-14">
      <Link
        href={`/memorial/${code}`}
        style={{ color: "hsl(var(--site-muted-fg))" }}
        className="inline-flex items-center gap-1.5 text-xs font-medium mb-6 hover:opacity-80"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to memorial
      </Link>

      <h1 style={headingFont} className="text-3xl md:text-4xl font-semibold mb-2">
        Edit memorial
      </h1>
      <p style={{ color: "hsl(var(--site-muted-fg))" }} className="text-sm mb-8">
        You're editing the public memorial page for <span style={{ color: "hsl(var(--site-fg))" }} className="font-medium">{memorial.deceasedName ?? "this memorial"}</span>. Anyone scanning the QR plaque can see your changes once you save.
      </p>

      <div className="space-y-6">
        {/* Edit PIN — required to save. Kept at the top so families see
            the requirement before filling out the form. */}
        <div
          style={{
            background: "hsl(var(--site-card))",
            border: "1px solid hsl(var(--site-border))",
            borderRadius: "var(--site-radius)",
          }}
          className="p-4"
        >
          <label
            htmlFor="memorial-edit-pin"
            className="flex items-center gap-1.5 text-xs uppercase tracking-widest font-semibold mb-2"
            style={{ color: "hsl(var(--site-primary))" }}
          >
            <KeyRound className="h-3.5 w-3.5" />
            Edit PIN
          </label>
          <input
            id="memorial-edit-pin"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={editPin}
            onChange={(e) => { setEditPin(e.target.value.replace(/\D/g, "").slice(0, 12)); setPinError(null); }}
            placeholder="6-digit PIN"
            maxLength={12}
            data-testid="edit-pin"
            style={{
              background: "hsl(var(--site-muted))",
              border: "1px solid hsl(var(--site-border))",
              borderRadius: "var(--site-radius)",
              color: "hsl(var(--site-fg))",
              letterSpacing: "0.2em",
            }}
            className="w-48 px-4 py-3 text-base font-mono"
          />
          <p className="text-xs mt-2" style={{ color: "hsl(var(--site-muted-fg))" }}>
            Ask {memorial.cemeteryName ?? "the cemetery"} for the PIN issued with your QR plaque. Without it your changes won't save, but the memorial stays viewable.
          </p>
          {stillLocked ? (
            <p
              className="text-xs mt-3 p-3"
              data-testid="edit-locked-notice"
              style={{
                background: "hsl(var(--site-muted))",
                border: "1px solid hsl(var(--site-border))",
                borderRadius: "var(--site-radius)",
                color: "hsl(var(--site-fg))",
              }}
            >
              This memorial is set to <strong>{memorial.visibility === "private" ? "Private" : "Basic"}</strong>. Enter the PIN above to load the existing biography, photos, and current settings.
            </p>
          ) : null}
        </div>

        {/* The rest of the form (privacy, title, bio, photos, save) is
            only shown once the memorial is unlocked — otherwise the
            empty defaults would clobber real content on save. */}
        {stillLocked ? null : <>

        {/* Privacy — three-way radio. Stored on the memorial row and
            enforced on every public GET. Families pick the level that
            matches how comfortable they are sharing online. */}
        <div
          style={{
            background: "hsl(var(--site-card))",
            border: "1px solid hsl(var(--site-border))",
            borderRadius: "var(--site-radius)",
          }}
          className="p-4"
          data-testid="edit-privacy"
        >
          <div
            className="text-xs uppercase tracking-widest font-semibold mb-3"
            style={{ color: "hsl(var(--site-primary))" }}
          >
            Privacy
          </div>
          <div className="space-y-2">
            {([
              { value: "open", icon: Globe, title: "Public",
                desc: "Anyone with the QR sees the full memorial — name, dates, plot, biography, photos." },
              { value: "basic", icon: Eye, title: "Basic info only",
                desc: "Visitors see name, dates, and plot location. Biography and photo gallery require the PIN." },
              { value: "private", icon: Lock, title: "Private",
                desc: "The whole memorial is hidden behind the PIN. Visitors must enter it to see anything." },
            ] as const).map(({ value, icon: Icon, title: optTitle, desc }) => {
              const checked = visibility === value;
              return (
                <label
                  key={value}
                  data-testid={`edit-privacy-${value}`}
                  style={{
                    background: checked ? "hsl(var(--site-muted))" : "transparent",
                    border: checked
                      ? "1px solid hsl(var(--site-primary))"
                      : "1px solid hsl(var(--site-border))",
                    borderRadius: "var(--site-radius)",
                  }}
                  className="flex items-start gap-3 p-3 cursor-pointer hover:opacity-90"
                >
                  <input
                    type="radio"
                    name="memorial-visibility"
                    value={value}
                    checked={checked}
                    onChange={() => setVisibility(value)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5 text-sm font-semibold mb-0.5">
                      <Icon className="h-3.5 w-3.5" style={{ color: "hsl(var(--site-primary))" }} />
                      {optTitle}
                    </div>
                    <div className="text-xs" style={{ color: "hsl(var(--site-muted-fg))" }}>
                      {desc}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        {/* Title */}
        <div>
          <label
            htmlFor="memorial-title"
            className="block text-xs uppercase tracking-widest font-semibold mb-2"
            style={{ color: "hsl(var(--site-primary))" }}
          >
            Memorial title
          </label>
          <input
            id="memorial-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            data-testid="edit-title"
            style={{
              background: "hsl(var(--site-card))",
              border: "1px solid hsl(var(--site-border))",
              borderRadius: "var(--site-radius)",
              color: "hsl(var(--site-fg))",
            }}
            className="w-full px-4 py-3 text-base"
          />
        </div>

        {/* Biography */}
        <div>
          <label
            htmlFor="memorial-bio"
            className="block text-xs uppercase tracking-widest font-semibold mb-2"
            style={{ color: "hsl(var(--site-primary))" }}
          >
            Biography & obituary
          </label>
          <textarea
            id="memorial-bio"
            value={biography}
            onChange={(e) => setBiography(e.target.value)}
            rows={10}
            maxLength={20000}
            placeholder={`Share their story — early life, family, work, the things they loved, the way they made others feel. Write as much or as little as feels right.`}
            data-testid="edit-biography"
            style={{
              background: "hsl(var(--site-card))",
              border: "1px solid hsl(var(--site-border))",
              borderRadius: "var(--site-radius)",
              color: "hsl(var(--site-fg))",
            }}
            className="w-full px-4 py-3 text-base leading-relaxed resize-y"
          />
          <p className="text-xs mt-1" style={{ color: "hsl(var(--site-muted-fg))" }}>
            {biography.length.toLocaleString()} / 20,000 characters
          </p>
        </div>

        {/* Photos */}
        <div>
          <label
            className="block text-xs uppercase tracking-widest font-semibold mb-2"
            style={{ color: "hsl(var(--site-primary))" }}
          >
            Photos
          </label>
          <div className="flex gap-2 mb-3">
            <input
              type="url"
              value={photoInput}
              onChange={(e) => setPhotoInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addPhoto(); } }}
              placeholder="https://example.com/photo.jpg"
              data-testid="edit-photo-input"
              style={{
                background: "hsl(var(--site-card))",
                border: "1px solid hsl(var(--site-border))",
                borderRadius: "var(--site-radius)",
                color: "hsl(var(--site-fg))",
              }}
              className="flex-1 px-4 py-2.5 text-sm"
            />
            <button
              type="button"
              onClick={addPhoto}
              data-testid="edit-photo-add"
              style={{
                background: "hsl(var(--site-primary))",
                color: "hsl(var(--site-primary-fg))",
                borderRadius: "var(--site-radius)",
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold"
            >
              <ImagePlus className="h-4 w-4" />
              Add photo
            </button>
          </div>
          {photoError ? (
            <p className="text-xs mb-3" style={{ color: "#c0392b" }}>{photoError}</p>
          ) : (
            <p className="text-xs mb-3" style={{ color: "hsl(var(--site-muted-fg))" }}>
              Paste image URLs from your photo storage (Google Photos, Dropbox direct link, iCloud share, etc.). Up to 20 images.
            </p>
          )}

          {photos.length > 0 ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {photos.map((url, i) => (
                <div
                  key={`${url}-${i}`}
                  className="relative group aspect-square"
                  style={{
                    background: `url(${url}) center/cover`,
                    border: "1px solid hsl(var(--site-border))",
                    borderRadius: "var(--site-radius)",
                  }}
                  data-testid={`edit-photo-${i}`}
                >
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    aria-label={`Remove photo ${i + 1}`}
                    data-testid={`edit-photo-remove-${i}`}
                    className="absolute top-1.5 right-1.5 h-7 w-7 rounded-full bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {/* Videos — YouTube only for now. Renders as a thumbnail grid with
            remove buttons so the editor mirrors the photo gallery UX. */}
        <div data-testid="edit-videos-section">
          <label
            className="block text-xs uppercase tracking-widest font-semibold mb-2"
            style={{ color: "hsl(var(--site-primary))" }}
          >
            Video gallery
          </label>
          <div className="flex gap-2 mb-3">
            <input
              type="url"
              value={videoInput}
              onChange={(e) => setVideoInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addVideo(); } }}
              placeholder="https://youtu.be/… or https://youtube.com/watch?v=…"
              data-testid="edit-video-input"
              style={{
                background: "hsl(var(--site-card))",
                border: "1px solid hsl(var(--site-border))",
                borderRadius: "var(--site-radius)",
                color: "hsl(var(--site-fg))",
              }}
              className="flex-1 px-4 py-2.5 text-sm"
            />
            <button
              type="button"
              onClick={addVideo}
              data-testid="edit-video-add"
              style={{
                background: "hsl(var(--site-primary))",
                color: "hsl(var(--site-primary-fg))",
                borderRadius: "var(--site-radius)",
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold"
            >
              <Video className="h-4 w-4" />
              Add video
            </button>
          </div>
          {videoError ? (
            <p className="text-xs mb-3" style={{ color: "#c0392b" }} data-testid="edit-video-error">{videoError}</p>
          ) : (
            <p className="text-xs mb-3" style={{ color: "hsl(var(--site-muted-fg))" }}>
              Paste up to 10 YouTube links — eulogies, slideshows, home movies. Visitors watch them embedded on the memorial page.
            </p>
          )}

          {videos.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {videos.map((url, i) => {
                const id = parseYouTubeId(url);
                return (
                  <div
                    key={`${url}-${i}`}
                    className="relative group"
                    style={{
                      background: id
                        ? `url(${youtubeThumbnailUrl(id)}) center/cover, hsl(var(--site-muted))`
                        : "hsl(var(--site-muted))",
                      border: "1px solid hsl(var(--site-border))",
                      borderRadius: "var(--site-radius)",
                      aspectRatio: "16 / 9",
                    }}
                    data-testid={`edit-video-${i}`}
                  >
                    <div
                      className="absolute inset-0 flex items-center justify-center"
                      style={{ background: "linear-gradient(180deg, transparent, rgba(0,0,0,0.4))" }}
                    >
                      <Video className="h-6 w-6 text-white drop-shadow" />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeVideo(i)}
                      aria-label={`Remove video ${i + 1}`}
                      data-testid={`edit-video-remove-${i}`}
                      className="absolute top-1.5 right-1.5 h-7 w-7 rounded-full bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>

        {/* Save */}
        <div
          style={{
            background: "hsl(var(--site-muted))",
            border: "1px solid hsl(var(--site-border))",
            borderRadius: "var(--site-radius)",
          }}
          className="p-5 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between"
        >
          <div className="text-xs" style={{ color: "hsl(var(--site-muted-fg))" }}>
            {pinError ? (
              <span style={{ color: "#c0392b" }} data-testid="edit-pin-error">{pinError}</span>
            ) : update.isError ? (
              <span style={{ color: "#c0392b" }}>Couldn't save — please check your connection and try again.</span>
            ) : savedAt ? (
              <span className="inline-flex items-center gap-1.5" data-testid="edit-saved" style={{ color: "hsl(var(--site-primary))" }}>
                <CheckCircle2 className="h-3.5 w-3.5" />
                Saved · changes are live on the public memorial page
              </span>
            ) : (
              <>Saving will publish your changes to anyone who scans the QR.</>
            )}
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={update.isPending}
            data-testid="edit-save"
            style={{
              background: "hsl(var(--site-primary))",
              color: "hsl(var(--site-primary-fg))",
              borderRadius: "var(--site-radius)",
              opacity: update.isPending ? 0.6 : 1,
            }}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 text-sm font-semibold disabled:cursor-not-allowed"
          >
            <Save className="h-4 w-4" />
            {update.isPending ? "Saving…" : "Save changes"}
          </button>
        </div>
        </>}
      </div>
    </div>
  );
}
