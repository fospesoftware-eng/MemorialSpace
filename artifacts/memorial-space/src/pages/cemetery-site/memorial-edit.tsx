import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, ImagePlus, Trash2, Save, CheckCircle2, KeyRound } from "lucide-react";
import { THEMES, isThemeKey, type ThemeKey } from "./themes";
import { usePublicMemorial, useUpdatePublicMemorial, type PublicSite } from "./api";

type Props = { slug: string; site: PublicSite; code: string };

export function CemeterySiteMemorialEdit({ slug, site, code }: Props) {
  const themeKey: ThemeKey = isThemeKey(site.theme) ? site.theme : "classic-marble";
  const theme = THEMES[themeKey];
  const headingFont = { fontFamily: theme.fontHeading };

  const { data: memorial, isLoading, isError } = usePublicMemorial(slug, code);
  const update = useUpdatePublicMemorial(slug, code);

  const [title, setTitle] = useState("");
  const [biography, setBiography] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoInput, setPhotoInput] = useState("");
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [editPin, setEditPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);

  // Hydrate the form once the memorial data arrives. We deliberately only
  // do this on the first load — once the user starts typing we don't want
  // a refetch (e.g. tab focus) to clobber their unsaved edits.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (memorial && !hydrated) {
      setTitle(memorial.title ?? memorial.deceasedName);
      setBiography(memorial.biography ?? "");
      setPhotos(memorial.photos ?? []);
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
    return (
      <div className="container mx-auto max-w-2xl px-4 sm:px-6 py-20 text-center">
        <h1 style={headingFont} className="text-3xl font-semibold mb-3">Memorial not found</h1>
        <Link
          href={`/c/${slug}/find-grave`}
          style={{ color: "hsl(var(--site-primary))" }}
          className="text-sm font-semibold"
        >
          Search for a grave
        </Link>
      </div>
    );
  }

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
        title: title.trim() || memorial.deceasedName,
        biography: biography.trim() || null,
        photos,
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
        href={`/c/${slug}/memorial/${code}`}
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
        You're editing the public memorial page for <span style={{ color: "hsl(var(--site-fg))" }} className="font-medium">{memorial.deceasedName}</span>. Anyone scanning the QR plaque can see your changes once you save.
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
      </div>
    </div>
  );
}
