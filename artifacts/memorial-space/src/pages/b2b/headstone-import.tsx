import { useMemo, useState, type ChangeEvent } from "react";
import {
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  Image as ImageIcon,
  Loader2,
  Plus,
  Trash2,
  Upload,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { fileToDataUrl, downscaleImage } from "@/lib/cemetery-config";

const BASE = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");

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
  plotNumber: string;
  latitude: number | null;
  longitude: number | null;
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
  sheetRowCount: number;
};

type CommitResponse = {
  plotsCreated: number;
  plotsUpdated: number;
  burialsCreated: number;
  burialsUpdated: number;
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

function toNumber(value: string): number | null {
  if (!value.trim()) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export default function HeadstoneImportPage() {
  const [sheet, setSheet] = useState<{ fileName: string; dataUrl: string } | null>(null);
  const [images, setImages] = useState<UploadImage[]>([]);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<CommitResponse | null>(null);

  const readyRows = useMemo(
    () => rows.filter((row) => row.plotNumber.trim() && row.people.some((p) => p.name.trim())),
    [rows],
  );

  const onSheet = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setSuccess(null);
    setSheet({ fileName: file.name, dataUrl: await fileToDataUrl(file) });
  };

  const onImages = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setError(null);
    setSuccess(null);
    const next: UploadImage[] = [];
    for (const file of files) {
      const data = await fileToDataUrl(file);
      const scaled = await downscaleImage(data, 1400, 0.8);
      next.push({ fileName: file.name, dataUrl: scaled.data });
    }
    setImages(next);
  };

  const analyze = async () => {
    if (!sheet || images.length === 0) {
      setError("Upload one spreadsheet and at least one headstone image.");
      return;
    }
    setAnalyzing(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await api<AnalyzeResponse>("/headstone-import/analyze", {
        method: "POST",
        body: JSON.stringify({ sheet, images }),
      });
      setRows(result.rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI scan failed.");
    } finally {
      setAnalyzing(false);
    }
  };

  const commit = async () => {
    setCommitting(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await api<CommitResponse>("/headstone-import/commit", {
        method: "POST",
        body: JSON.stringify({ rows: readyRows }),
      });
      setSuccess(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setCommitting(false);
    }
  };

  const patchRow = (index: number, patch: Partial<ReviewRow>) => {
    setRows((prev) => prev.map((row, i) => i === index ? { ...row, ...patch } : row));
  };

  const patchPerson = (rowIndex: number, personIndex: number, patch: Partial<Person>) => {
    setRows((prev) => prev.map((row, i) => {
      if (i !== rowIndex) return row;
      return {
        ...row,
        people: row.people.map((person, p) => p === personIndex ? { ...person, ...patch } : person),
      };
    }));
  };

  const addPerson = (rowIndex: number) => {
    setRows((prev) => prev.map((row, i) => i === rowIndex
      ? { ...row, people: [...row.people, { name: "", dateOfBirth: null, dateOfDeath: null }], isFamilyHeadstone: true }
      : row));
  };

  const removePerson = (rowIndex: number, personIndex: number) => {
    setRows((prev) => prev.map((row, i) => {
      if (i !== rowIndex) return row;
      const people = row.people.filter((_, p) => p !== personIndex);
      return { ...row, people };
    }));
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Headstone AI Import</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Upload headstone photos with a spreadsheet that includes image filename, plot or spot number, latitude, and longitude. Claude reads inscriptions, flags family headstones, and prepares records for review before writing to the map.
          </p>
        </div>
        <Button
          className="gap-2"
          onClick={analyze}
          disabled={analyzing || !sheet || images.length === 0}
          data-testid="button-run-headstone-ai"
        >
          {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
          {analyzing ? "Scanning..." : "Run AI scan"}
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Import needs attention</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>Imported into cemetery records</AlertTitle>
          <AlertDescription>
            Plots created: {success.plotsCreated}. Plots updated: {success.plotsUpdated}. Burials created: {success.burialsCreated}. Burials updated: {success.burialsUpdated}.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              Spreadsheet
            </CardTitle>
            <CardDescription>Accepted columns include image filename, spot number or plot number, lat, long, latitude, and longitude.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input type="file" accept=".xlsx,.xls,.csv" onChange={onSheet} data-testid="input-headstone-sheet" />
            {sheet && <Badge variant="outline">{sheet.fileName}</Badge>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ImageIcon className="h-5 w-5 text-primary" />
              Headstone Images
            </CardTitle>
            <CardDescription>Filenames must match the spreadsheet image filename column. Images are compressed before scanning.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input type="file" accept="image/*" multiple onChange={onImages} data-testid="input-headstone-images" />
            <div className="flex flex-wrap gap-2">
              {images.map((image) => (
                <Badge key={image.fileName} variant="outline">{image.fileName}</Badge>
              ))}
              {images.length === 0 && <span className="text-sm text-muted-foreground">No images selected.</span>}
            </div>
          </CardContent>
        </Card>
      </div>

      {rows.length > 0 && (
        <Card>
          <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Review extracted records</CardTitle>
              <CardDescription>Edit names, dates, plot numbers, and coordinates before importing to the cemetery map.</CardDescription>
            </div>
            <Button
              className="gap-2"
              onClick={commit}
              disabled={committing || readyRows.length === 0}
              data-testid="button-commit-headstone-import"
            >
              {committing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Import {readyRows.length} ready row{readyRows.length === 1 ? "" : "s"}
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {rows.map((row, rowIndex) => (
              <div key={`${row.imageFileName}-${rowIndex}`} className="rounded-lg border border-border/70 bg-background p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{row.imageFileName || "Missing filename"}</h3>
                      <Badge variant={row.status === "ready" ? "default" : "outline"}>{row.status}</Badge>
                      <Badge variant="outline">{Math.round((row.confidence ?? 0) * 100)}% confidence</Badge>
                    </div>
                    {row.inscriptionText && (
                      <p className="max-w-4xl text-xs text-muted-foreground">{row.inscriptionText}</p>
                    )}
                    {row.warnings?.length > 0 && (
                      <p className="text-xs text-amber-500">{row.warnings.join(" ")}</p>
                    )}
                  </div>
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Checkbox
                      checked={row.isFamilyHeadstone}
                      onCheckedChange={(v) => patchRow(rowIndex, { isFamilyHeadstone: Boolean(v) })}
                    />
                    Family headstone
                  </label>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-4">
                  <div className="space-y-1">
                    <Label>Plot / Spot number</Label>
                    <Input value={row.plotNumber} onChange={(e) => patchRow(rowIndex, { plotNumber: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Latitude</Label>
                    <Input value={row.latitude ?? ""} onChange={(e) => patchRow(rowIndex, { latitude: toNumber(e.target.value) })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Longitude</Label>
                    <Input value={row.longitude ?? ""} onChange={(e) => patchRow(rowIndex, { longitude: toNumber(e.target.value) })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Notes</Label>
                    <Input value={row.notes ?? ""} onChange={(e) => patchRow(rowIndex, { notes: e.target.value })} />
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">People on headstone</p>
                    <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => addPerson(rowIndex)}>
                      <Plus className="h-3.5 w-3.5" />
                      Add person
                    </Button>
                  </div>
                  {row.people.length === 0 && (
                    <Textarea
                      value={row.inscriptionText}
                      onChange={(e) => patchRow(rowIndex, { inscriptionText: e.target.value })}
                      placeholder="No person extracted. Add a person manually, or keep inscription notes here."
                    />
                  )}
                  {row.people.map((person, personIndex) => (
                    <div key={personIndex} className="grid gap-3 md:grid-cols-[1fr_160px_160px_auto]">
                      <Input
                        value={person.name}
                        onChange={(e) => patchPerson(rowIndex, personIndex, { name: e.target.value })}
                        placeholder="Full name"
                      />
                      <Input
                        value={person.dateOfBirth ?? ""}
                        onChange={(e) => patchPerson(rowIndex, personIndex, { dateOfBirth: e.target.value || null })}
                        placeholder="Birth date"
                      />
                      <Input
                        value={person.dateOfDeath ?? ""}
                        onChange={(e) => patchPerson(rowIndex, personIndex, { dateOfDeath: e.target.value || null })}
                        placeholder="Death date"
                      />
                      <Button type="button" variant="outline" size="icon" onClick={() => removePerson(rowIndex, personIndex)}>
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Remove person</span>
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
