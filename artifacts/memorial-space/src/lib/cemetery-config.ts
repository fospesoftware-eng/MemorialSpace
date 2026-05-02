import { useCallback, useEffect, useState } from "react";
import { Cross, Star, Heart, Shield, Flower2, Flag, Award, Circle } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface PlotType {
  id: string;
  code: string;
  name: string;
  fill: string;
  stroke: string;
  description?: string;
}

export type SpotIconKey = "cross" | "star" | "heart" | "shield" | "flower" | "flag" | "award" | "circle";

export const SPOT_ICONS: Record<SpotIconKey, LucideIcon> = {
  cross:  Cross,
  star:   Star,
  heart:  Heart,
  shield: Shield,
  flower: Flower2,
  flag:   Flag,
  award:  Award,
  circle: Circle,
};

export const SPOT_ICON_KEYS: SpotIconKey[] = ["cross", "star", "heart", "shield", "flower", "flag", "award", "circle"];

export interface SpotType {
  id: string;
  name: string;
  color: string;
  icon: SpotIconKey;
}

export interface BackgroundEntry {
  id: string;
  name: string;
  image: string;
  imgWidth: number;
  imgHeight: number;
  addedAt: number;
}

export interface BurialSpot {
  id: string;
  x: number;
  y: number;
  name: string;
  dob?: string;
  dod?: string;
  spotTypeId: string;
  headstoneImage?: string;
  lat?: number;
  lon?: number;
  notes?: string;
}

export const DEFAULT_PLOT_TYPES: PlotType[] = [
  { id: "RC",       code: "RC",  name: "Roman Catholic",  fill: "#a8d5d2", stroke: "#5a9290", description: "Catholic section" },
  { id: "CON",      code: "CON", name: "Consecrated",     fill: "#6ba5a3", stroke: "#3d7572", description: "Consecrated ground" },
  { id: "FC",       code: "FC",  name: "Free Church",     fill: "#3d6b6a", stroke: "#244442", description: "Non-denominational" },
  { id: "MU",       code: "MU",  name: "Muslim",          fill: "#8b9bbf", stroke: "#5a6a8c", description: "Muslim section" },
  { id: "PATH",     code: "PATH",name: "Path / Road",     fill: "#d1d5db", stroke: "#9ca3af", description: "Walkway or road" },
  { id: "BUILDING", code: "BLD", name: "Building",        fill: "#475569", stroke: "#1e293b", description: "Office, chapel, etc." },
];

export const DEFAULT_SPOT_TYPES: SpotType[] = [
  { id: "civilian",         name: "Civilian",                color: "#64748b", icon: "cross" },
  { id: "veteran-army",     name: "Veteran — US Army",       color: "#4d7c0f", icon: "star" },
  { id: "veteran-navy",     name: "Veteran — US Navy",       color: "#1e40af", icon: "star" },
  { id: "veteran-marines",  name: "Veteran — US Marines",    color: "#b91c1c", icon: "star" },
  { id: "veteran-airforce", name: "Veteran — US Air Force",  color: "#0284c7", icon: "star" },
  { id: "child",            name: "Child",                   color: "#db2777", icon: "heart" },
  { id: "clergy",           name: "Clergy",                  color: "#7c3aed", icon: "cross" },
  { id: "first-responder",  name: "First Responder",         color: "#ea580c", icon: "shield" },
];

export const FALLBACK_PLOT_TYPE: PlotType = {
  id: "_unknown", code: "?", name: "Unknown", fill: "#9ca3af", stroke: "#4b5563",
};
export const FALLBACK_SPOT_TYPE: SpotType = {
  id: "_unknown", name: "Unknown", color: "#6b7280", icon: "circle",
};

export const STATUS_COLORS = {
  available: "#22c55e",
  reserved:  "#eab308",
  occupied:  "#ef4444",
} as const;

export type PlotStatus = keyof typeof STATUS_COLORS;

export const PLOT_TYPES_KEY = "memorialspace.plot-types";
export const SPOT_TYPES_KEY = "memorialspace.spot-types";
export const BACKGROUNDS_KEY = "memorialspace.bg-library";
export const BACKGROUND_LIBRARY_LIMIT = 6;

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed as T;
  } catch {
    return fallback;
  }
}

function writeJSON<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent(`stored:${key}`));
}

export function useStored<T>(key: string, fallback: T): [T, (next: T | ((prev: T) => T)) => void, Error | null] {
  const [value, setValue] = useState<T>(() => readJSON(key, fallback));
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const onChange = () => setValue(readJSON(key, fallback));
    window.addEventListener("storage", onChange);
    window.addEventListener(`stored:${key}`, onChange);
    return () => {
      window.removeEventListener("storage", onChange);
      window.removeEventListener(`stored:${key}`, onChange);
    };
    // fallback intentionally excluded: callers must pass a stable ref (module-level constant).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const setStored = useCallback((next: T | ((prev: T) => T)) => {
    setValue((prev) => {
      const v = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
      try {
        writeJSON(key, v);
        setError(null);
        return v;
      } catch (err) {
        // Persistence failed (most often QuotaExceededError). Keep in-memory
        // state in sync with disk so the UI doesn't claim a save succeeded.
        setError(err instanceof Error ? err : new Error(String(err)));
        return prev;
      }
    });
  }, [key]);

  return [value, setStored, error];
}

export function usePlotTypes() {
  return useStored<PlotType[]>(PLOT_TYPES_KEY, DEFAULT_PLOT_TYPES);
}
export function useSpotTypes() {
  return useStored<SpotType[]>(SPOT_TYPES_KEY, DEFAULT_SPOT_TYPES);
}
export function useBackgrounds() {
  return useStored<BackgroundEntry[]>(BACKGROUNDS_KEY, []);
}

export function newId(prefix = "x"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("File read failed"));
    reader.readAsDataURL(file);
  });
}

export interface DownscaledImage { data: string; width: number; height: number }

export function downscaleImage(dataUrl: string, maxWidth: number, quality = 0.82): Promise<DownscaledImage> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const ratio = img.naturalWidth > maxWidth ? maxWidth / img.naturalWidth : 1;
      const w = Math.max(1, Math.round(img.naturalWidth * ratio));
      const h = Math.max(1, Math.round(img.naturalHeight * ratio));
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Canvas 2D context unavailable")); return; }
      ctx.drawImage(img, 0, 0, w, h);
      let out: string;
      try {
        out = canvas.toDataURL("image/webp", quality);
        // Some browsers fall back to PNG silently if webp not supported
        if (!out.startsWith("data:image/webp")) out = canvas.toDataURL("image/jpeg", quality);
      } catch {
        out = canvas.toDataURL("image/jpeg", quality);
      }
      resolve({ data: out, width: w, height: h });
    };
    img.onerror = () => reject(new Error("Image decode failed"));
    img.src = dataUrl;
  });
}

export function calcAge(dob?: string, dod?: string): number | null {
  if (!dob) return null;
  const start = new Date(dob);
  const end = dod ? new Date(dod) : new Date();
  if (isNaN(start.valueOf()) || isNaN(end.valueOf())) return null;
  let age = end.getFullYear() - start.getFullYear();
  const m = end.getMonth() - start.getMonth();
  if (m < 0 || (m === 0 && end.getDate() < start.getDate())) age--;
  return age >= 0 && age < 200 ? age : null;
}
