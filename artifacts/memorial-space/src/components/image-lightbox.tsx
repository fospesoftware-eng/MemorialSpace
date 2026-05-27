/**
 * Reusable image lightbox / gallery viewer.
 * Opens a full-screen dialog with prev/next navigation and keyboard support.
 */
import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface ImageLightboxProps {
  images: string[];
  open: boolean;
  initialIndex?: number;
  onOpenChange: (open: boolean) => void;
  title?: string;
}

export function ImageLightbox({
  images,
  open,
  initialIndex = 0,
  onOpenChange,
  title,
}: ImageLightboxProps) {
  const [index, setIndex] = useState(initialIndex);

  useEffect(() => {
    if (open) setIndex(Math.min(initialIndex, Math.max(0, images.length - 1)));
  }, [open, initialIndex, images.length]);

  const goPrev = useCallback(() => {
    setIndex((i) => (i > 0 ? i - 1 : images.length - 1));
  }, [images.length]);

  const goNext = useCallback(() => {
    setIndex((i) => (i < images.length - 1 ? i + 1 : 0));
  }, [images.length]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, goPrev, goNext, onOpenChange]);

  if (images.length === 0) return null;

  const safeIndex = Math.min(index, Math.max(0, images.length - 1));
  const img = images[safeIndex];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] p-0 border-0 bg-black/90 overflow-hidden">
        <DialogTitle className="sr-only">{title ?? "Image preview"}</DialogTitle>
        <div className="relative flex items-center justify-center min-h-[60vh] max-h-[85vh]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={img}
            alt={`${title ?? "Image"} ${safeIndex + 1} of ${images.length}`}
            className="max-h-[80vh] max-w-full object-contain"
          />

          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); goPrev(); }}
                className="absolute left-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
                aria-label="Previous image"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); goNext(); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
                aria-label="Next image"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}
        </div>

        {/* Thumbnail strip */}
        {images.length > 1 && (
          <div className="flex gap-2 p-3 overflow-x-auto bg-black/60">
            {images.map((src, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIndex(i)}
                className={`shrink-0 rounded-sm overflow-hidden border-2 transition-colors ${
                  i === index ? "border-primary" : "border-transparent hover:border-white/40"
                }`}
                aria-label={`Go to image ${i + 1}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="h-14 w-14 object-cover"
                />
              </button>
            ))}
          </div>
        )}

        {/* Counter */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 text-white/70 text-sm bg-black/40 px-3 py-1 rounded-full">
          {safeIndex + 1} / {images.length}
        </div>
      </DialogContent>
    </Dialog>
  );
}
