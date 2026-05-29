import { useMemo, useState, type ChangeEvent } from "react";
import {
  AlertCircle,
  CheckCircle2,
  FolderOpen,
  Image as ImageIcon,
  Loader2,
  Plus,
  Trash2,
  Upload,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { fileToDataUrl, downscaleImage } from "@/lib/cemetery-config";

const BASE = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
const SCAN_BATCH_SIZE = 8;

type UploadImage = {
  fileName: string;
  dataUrl: string;
};

type Person = {
  name: string;
  dateOfBirth: string | null;
  dateOfDeath: string | null;
};

type ReviewRow = {
  imageFileName: string;
  storedPath: string;
  previewDataUrl?: string;
  status: string;
  isFamilyHeadstone: boolean;
  people: Person[];
  confidence: number;
  inscriptionText: string;
  warnings: string[];
  notes?: string | null;
};

type AnalyzeResponse = {
  rows: ReviewRow[];
  imageCount: number;
  folder: string;
};

type VerifyResponse = {
  verifiedCount: number;
  needsManualEntryCount: number;
  imageCount: number;
  folder: string;
  manifestPath: string;
};

async function api<T>(path: string, init: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
    credentials: "include",
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(body?.error ?? `Request failed (${res.status})`);
  return body as T;
}

const emptyPerson: Person = {
  name: "",
  dateOfBirth: null,
  dateOfDeath: null,
};

export default function HeadstoneImportPage() {
  const [images, setImages] = useState<UploadImage[]>([]);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [folder, setFolder] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<VerifyResponse | null>(null);

  const missingCount = useMemo(
    () =>
      rows.filter((row) => !row.people.some((person) => person.name.trim()))
        .length,
    [rows],
  );

  const onImages = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setError(null);
    setSuccess(null);
    setRows([]);
    setFolder(null);
    const next: UploadImage[] = [];
    for (const file of files) {
      const data = await fileToDataUrl(file);
      const scaled = await downscaleImage(data, 1400, 0.8);
      next.push({ fileName: file.name, dataUrl: scaled.data });
    }
    setImages(next);
  };

  const analyze = async () => {
    if (images.length === 0) {
      setError("Upload at least one headstone image.");
      return;
    }
    setAnalyzing(true);
    setError(null);
    setSuccess(null);
    setRows([]);
    setFolder(null);
    try {
      const previewByName = new Map(
        images.map((image) => [image.fileName, image.dataUrl]),
      );
      const allRows: ReviewRow[] = [];
      let activeFolder: string | null = null;

      for (let start = 0; start < images.length; start += SCAN_BATCH_SIZE) {
        const batch = images.slice(start, start + SCAN_BATCH_SIZE);
        const result = await api<AnalyzeResponse>("/headstone-import/analyze", {
          method: "POST",
          body: JSON.stringify({ images: batch }),
        });
        activeFolder = result.folder;
        const scannedRows = result.rows.map((row) => ({
          ...row,
          previewDataUrl: previewByName.get(row.imageFileName),
          people: row.people.length > 0 ? row.people : [{ ...emptyPerson }],
        }));
        allRows.push(...scannedRows);
        setFolder(activeFolder);
        setRows([...allRows]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI scan failed.");
    } finally {
      setAnalyzing(false);
    }
  };

  const saveVerified = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await api<VerifyResponse>("/headstone-import/verify", {
        method: "POST",
        body: JSON.stringify({
          rows: rows.map(({ previewDataUrl, ...row }) => row),
        }),
      });
      setSuccess(result);
      setFolder(result.folder);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save review.");
    } finally {
      setSaving(false);
    }
  };

  const patchRow = (index: number, patch: Partial<ReviewRow>) => {
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  };

  const patchPerson = (
    rowIndex: number,
    personIndex: number,
    patch: Partial<Person>,
  ) => {
    setRows((prev) =>
      prev.map((row, i) => {
        if (i !== rowIndex) return row;
        return {
          ...row,
          people: row.people.map((person, p) =>
            p === personIndex ? { ...person, ...patch } : person,
          ),
        };
      }),
    );
  };

  const addPerson = (rowIndex: number) => {
    setRows((prev) =>
      prev.map((row, i) =>
        i === rowIndex
          ? {
              ...row,
              people: [...row.people, { ...emptyPerson }],
              isFamilyHeadstone: true,
            }
          : row,
      ),
    );
  };

  const removePerson = (rowIndex: number, personIndex: number) => {
    setRows((prev) =>
      prev.map((row, i) => {
        if (i !== rowIndex) return row;
        const people = row.people.filter((_, p) => p !== personIndex);
        return { ...row, people: people.length > 0 ? people : [{ ...emptyPerson }] };
      }),
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Headstone AI Import
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Bulk upload headstone images only. MemorialSpace stores each image
            under the cemetery headstone folder using the original filename,
            reads names and dates with Claude, then opens a verification screen
            for manual corrections before spreadsheet matching in Import Center.
          </p>
        </div>
        <Button
          className="gap-2"
          onClick={analyze}
          disabled={analyzing || images.length === 0}
          data-testid="button-run-headstone-ai"
        >
          {analyzing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Wand2 className="h-4 w-4" />
          )}
          {analyzing ? "Scanning..." : "Scan images"}
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Headstone import needs attention</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>Headstone verification saved</AlertTitle>
          <AlertDescription>
            Saved {success.imageCount} image records in {success.folder}.{" "}
            {success.verifiedCount} verified,{" "}
            {success.needsManualEntryCount} still missing names.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ImageIcon className="h-5 w-5 text-primary" />
            Bulk Headstone Images
          </CardTitle>
          <CardDescription>
            Select multiple image files. Filenames are preserved so spreadsheet
            imports can match rows to these headstone images later.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            type="file"
            accept="image/*"
            multiple
            onChange={onImages}
            data-testid="input-headstone-images"
          />
          <div className="flex flex-wrap gap-2">
            {images.map((image) => (
              <Badge key={image.fileName} variant="outline">
                {image.fileName}
              </Badge>
            ))}
            {images.length === 0 && (
              <span className="text-sm text-muted-foreground">
                No images selected.
              </span>
            )}
          </div>
          {folder && (
            <div className="flex items-center gap-2 rounded-md border border-border/70 bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
              <FolderOpen className="h-4 w-4 text-primary" />
              Cemetery headstone folder: {folder}
            </div>
          )}
        </CardContent>
      </Card>

      {rows.length > 0 && (
        <Card>
          <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Verify AI Image Reading</CardTitle>
              <CardDescription>
                Check every image. If Claude missed a name or date, enter it
                here before saving the headstone image library.
              </CardDescription>
            </div>
            <Button
              className="gap-2"
              onClick={saveVerified}
              disabled={saving || rows.length === 0}
              data-testid="button-save-headstone-verification"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {saving ? "Saving..." : "Save verification"}
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {missingCount > 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Manual entry needed</AlertTitle>
                <AlertDescription>
                  {missingCount} image{missingCount === 1 ? "" : "s"} have no
                  person name yet. Add the visible text before final matching.
                </AlertDescription>
              </Alert>
            )}

            {rows.map((row, rowIndex) => {
              const needsName = !row.people.some((person) => person.name.trim());
              return (
                <div
                  key={`${row.imageFileName}-${rowIndex}`}
                  className="grid gap-4 rounded-lg border border-border/70 bg-background p-4 lg:grid-cols-[220px_1fr]"
                >
                  <div className="space-y-3">
                    <div className="overflow-hidden rounded-md border border-border/70 bg-muted">
                      {row.previewDataUrl || row.storedPath ? (
                        <img
                          src={row.previewDataUrl ?? row.storedPath}
                          alt={row.imageFileName}
                          className="aspect-[4/3] w-full object-cover"
                        />
                      ) : (
                        <div className="flex aspect-[4/3] items-center justify-center text-muted-foreground">
                          <ImageIcon className="h-8 w-8" />
                        </div>
                      )}
                    </div>
                    <div className="space-y-1">
                      <p className="break-all text-sm font-semibold">
                        {row.imageFileName}
                      </p>
                      <Badge variant={needsName ? "outline" : "default"}>
                        {needsName ? "Needs manual entry" : "Ready"}
                      </Badge>
                      <Badge variant="outline">
                        {Math.round((row.confidence ?? 0) * 100)}% confidence
                      </Badge>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-1">
                        {row.inscriptionText && (
                          <p className="max-w-4xl whitespace-pre-line text-xs text-muted-foreground">
                            {row.inscriptionText}
                          </p>
                        )}
                        {row.warnings?.length > 0 && (
                          <p className="text-xs text-amber-500">
                            {row.warnings.join(" ")}
                          </p>
                        )}
                      </div>
                      <label className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Checkbox
                          checked={row.isFamilyHeadstone}
                          onCheckedChange={(v) =>
                            patchRow(rowIndex, {
                              isFamilyHeadstone: Boolean(v),
                            })
                          }
                        />
                        Family headstone
                      </label>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">
                          Names and dates on image
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          onClick={() => addPerson(rowIndex)}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Add person
                        </Button>
                      </div>
                      {row.people.map((person, personIndex) => (
                        <div
                          key={personIndex}
                          className="grid gap-3 md:grid-cols-[1fr_160px_160px_auto]"
                        >
                          <Input
                            value={person.name}
                            onChange={(e) =>
                              patchPerson(rowIndex, personIndex, {
                                name: e.target.value,
                              })
                            }
                            placeholder="Full name"
                          />
                          <Input
                            value={person.dateOfBirth ?? ""}
                            onChange={(e) =>
                              patchPerson(rowIndex, personIndex, {
                                dateOfBirth: e.target.value || null,
                              })
                            }
                            placeholder="Birth date"
                          />
                          <Input
                            value={person.dateOfDeath ?? ""}
                            onChange={(e) =>
                              patchPerson(rowIndex, personIndex, {
                                dateOfDeath: e.target.value || null,
                              })
                            }
                            placeholder="Death date"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => removePerson(rowIndex, personIndex)}
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Remove person</span>
                          </Button>
                        </div>
                      ))}
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-1">
                        <Label>Readable inscription text</Label>
                        <Textarea
                          value={row.inscriptionText}
                          onChange={(e) =>
                            patchRow(rowIndex, {
                              inscriptionText: e.target.value,
                            })
                          }
                          placeholder="Enter visible text if AI missed it."
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Reviewer notes</Label>
                        <Textarea
                          value={row.notes ?? ""}
                          onChange={(e) =>
                            patchRow(rowIndex, { notes: e.target.value })
                          }
                          placeholder="Optional notes for later spreadsheet matching."
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
