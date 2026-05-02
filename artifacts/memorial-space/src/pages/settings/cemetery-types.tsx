import { useState } from "react";
import { Plus, Trash2, Image as ImageIcon, RotateCcw, AlertCircle, Square, Circle as CircleIcon, Spline } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  usePlotTypes, useSpotTypes, useBackgrounds,
  DEFAULT_PLOT_TYPES, DEFAULT_SPOT_TYPES,
  SPOT_ICONS, SPOT_ICON_KEYS,
  type PlotType, type PlotShape, type SpotType, type SpotIconKey,
  newId,
} from "@/lib/cemetery-config";

// Shape options shown in the per-plot-type Shape selector. Picking one
// here changes which canvas tool the Map Maker auto-activates when the
// user clicks this plot type in the palette.
const PLOT_SHAPE_OPTIONS: { value: PlotShape; label: string; hint: string }[] = [
  { value: "rect",   label: "Rectangle", hint: "Drag to draw an axis-aligned rectangle (sections, buildings)." },
  { value: "circle", label: "Circle",    hint: "Drag from center outward to set radius (ponds, gardens)." },
  { value: "path",   label: "Flexible",  hint: "Click vertices to draw a polyline (roads, paths, bridges)." },
];

const SHAPE_ICONS: Record<PlotShape, typeof Square> = {
  rect:   Square,
  circle: CircleIcon,
  path:   Spline,
};

export default function CemeteryTypes() {
  const [plotTypes, setPlotTypes, plotErr] = usePlotTypes();
  const [spotTypes, setSpotTypes, spotErr] = useSpotTypes();
  const [backgrounds, setBackgrounds, bgErr] = useBackgrounds();

  // Plot type CRUD
  const addPlotType = () => {
    const t: PlotType = {
      id: newId("pt"), code: "NEW", name: "New plot type",
      fill: "#cbd5e1", stroke: "#64748b", description: "",
      defaultShape: "rect",
    };
    setPlotTypes((prev) => [...prev, t]);
  };
  const updatePlotType = (id: string, patch: Partial<PlotType>) => {
    setPlotTypes((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };
  const removePlotType = (id: string) => {
    setPlotTypes((prev) => prev.filter((p) => p.id !== id));
  };

  // Spot type CRUD
  const addSpotType = () => {
    const t: SpotType = { id: newId("st"), name: "New spot type", color: "#475569", icon: "circle" };
    setSpotTypes((prev) => [...prev, t]);
  };
  const updateSpotType = (id: string, patch: Partial<SpotType>) => {
    setSpotTypes((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };
  const removeSpotType = (id: string) => {
    setSpotTypes((prev) => prev.filter((s) => s.id !== id));
  };

  const removeBackground = (id: string) => {
    setBackgrounds((prev) => prev.filter((b) => b.id !== id));
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Cemetery Setup</h1>
        <p className="text-muted-foreground mt-1">
          Configure plot types, burial spot categories, and reusable map backgrounds. These settings power the
          <span className="text-primary"> Map Maker</span> and reports across your cemetery.
        </p>
      </div>

      {(plotErr || spotErr || bgErr) && (
        <div className="flex items-start gap-2 rounded-md border border-destructive bg-destructive/10 text-destructive p-3 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>Could not save changes locally — your browser may be out of storage. Older entries (especially large background images) can be removed below.</div>
        </div>
      )}

      {/* Plot Types */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-lg">Plot Types</CardTitle>
              <CardDescription>Sections of your cemetery. Each plot drawn on a map belongs to one of these types.</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setPlotTypes(DEFAULT_PLOT_TYPES)} data-testid="reset-plot-types">
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Reset defaults
              </Button>
              <Button size="sm" onClick={addPlotType} data-testid="add-plot-type">
                <Plus className="h-3.5 w-3.5 mr-1.5" /> Add plot type
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="hidden md:grid grid-cols-[60px_100px_1fr_1fr_130px_60px_60px_36px] gap-2 px-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            <div>Preview</div>
            <div>Code</div>
            <div>Name</div>
            <div>Description</div>
            <div>Shape</div>
            <div>Fill</div>
            <div>Stroke</div>
            <div></div>
          </div>
          {plotTypes.length === 0 && (
            <p className="text-sm text-muted-foreground p-4 text-center border border-dashed rounded-md">
              No plot types yet. Click <strong>Add plot type</strong> or <strong>Reset defaults</strong> to seed the standard set.
            </p>
          )}
          {plotTypes.map((p) => {
            const shape: PlotShape = p.defaultShape ?? "rect";
            const ShapeIcon = SHAPE_ICONS[shape];
            return (
              <div
                key={p.id}
                data-testid={`plot-type-row-${p.id}`}
                className="grid grid-cols-2 md:grid-cols-[60px_100px_1fr_1fr_130px_60px_60px_36px] gap-2 items-center rounded-md border border-border bg-background p-2"
              >
                <div className="flex items-center justify-center">
                  <div
                    className="h-8 w-12 rounded border-2 flex items-center justify-center text-[10px] font-semibold text-white"
                    style={{ background: p.fill, borderColor: p.stroke, color: isLight(p.fill) ? "#1f2937" : "#fff" }}
                  >
                    {p.code}
                  </div>
                </div>
                <Input
                  value={p.code}
                  maxLength={8}
                  onChange={(e) => updatePlotType(p.id, { code: e.target.value.toUpperCase() })}
                  className="h-8 font-mono text-xs"
                  data-testid={`plot-type-code-${p.id}`}
                />
                <Input
                  value={p.name}
                  onChange={(e) => updatePlotType(p.id, { name: e.target.value })}
                  className="h-8"
                  data-testid={`plot-type-name-${p.id}`}
                />
                <Input
                  value={p.description ?? ""}
                  onChange={(e) => updatePlotType(p.id, { description: e.target.value })}
                  placeholder="Optional description"
                  className="h-8"
                />
                {/* Default drawing shape — clicking this plot type in the
                    Map Maker palette auto-activates the matching tool. */}
                <Select
                  value={shape}
                  onValueChange={(v) => updatePlotType(p.id, { defaultShape: v as PlotShape })}
                >
                  <SelectTrigger className="h-8" data-testid={`plot-type-shape-${p.id}`} aria-label={`Default shape for ${p.name}`}>
                    <SelectValue>
                      <span className="flex items-center gap-1.5 text-xs">
                        <ShapeIcon className="h-3.5 w-3.5" /> {PLOT_SHAPE_OPTIONS.find((o) => o.value === shape)?.label}
                      </span>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {PLOT_SHAPE_OPTIONS.map((opt) => {
                      const I = SHAPE_ICONS[opt.value];
                      return (
                        <SelectItem key={opt.value} value={opt.value}>
                          <div className="flex items-start gap-2">
                            <I className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                            <div>
                              <div className="text-xs font-medium">{opt.label}</div>
                              <div className="text-[10px] text-muted-foreground">{opt.hint}</div>
                            </div>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                <Input
                  type="color"
                  value={p.fill}
                  onChange={(e) => updatePlotType(p.id, { fill: e.target.value })}
                  className="h-8 w-full p-0.5 cursor-pointer"
                  data-testid={`plot-type-fill-${p.id}`}
                />
                <Input
                  type="color"
                  value={p.stroke}
                  onChange={(e) => updatePlotType(p.id, { stroke: e.target.value })}
                  className="h-8 w-full p-0.5 cursor-pointer"
                />
                <Button
                  variant="ghost" size="sm"
                  onClick={() => removePlotType(p.id)}
                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                  data-testid={`plot-type-delete-${p.id}`}
                  aria-label={`Delete ${p.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
          <p className="text-xs text-muted-foreground pt-2">
            <strong>Tip:</strong> The <strong>Shape</strong> column controls which drawing tool the Map Maker auto-selects when you click this plot type in its palette. You can still pick any tool manually from the Map Maker toolbar (R = Rectangle, C = Circle, P = Path). Existing plots on saved maps that reference a deleted type will render in gray with a "?" code until you re-assign them.
          </p>
        </CardContent>
      </Card>

      {/* Spot Types */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-lg">Burial Spot Types</CardTitle>
              <CardDescription>Categories for individual burial spots — used by the Map Maker spot tool to colour-code pins.</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setSpotTypes(DEFAULT_SPOT_TYPES)} data-testid="reset-spot-types">
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Reset defaults
              </Button>
              <Button size="sm" onClick={addSpotType} data-testid="add-spot-type">
                <Plus className="h-3.5 w-3.5 mr-1.5" /> Add spot type
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="hidden md:grid grid-cols-[60px_1fr_140px_60px_36px] gap-2 px-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            <div>Pin</div>
            <div>Name</div>
            <div>Icon</div>
            <div>Color</div>
            <div></div>
          </div>
          {spotTypes.length === 0 && (
            <p className="text-sm text-muted-foreground p-4 text-center border border-dashed rounded-md">
              No spot types configured. Add some, or reset to the standard veteran / civilian / clergy set.
            </p>
          )}
          {spotTypes.map((s) => {
            const Icon = SPOT_ICONS[s.icon] ?? SPOT_ICONS.circle;
            return (
              <div
                key={s.id}
                data-testid={`spot-type-row-${s.id}`}
                className="grid grid-cols-2 md:grid-cols-[60px_1fr_140px_60px_36px] gap-2 items-center rounded-md border border-border bg-background p-2"
              >
                <div className="flex items-center justify-center">
                  <div
                    className="h-9 w-9 rounded-full flex items-center justify-center border-2 border-white shadow-sm"
                    style={{ background: s.color }}
                  >
                    <Icon className="h-4 w-4 text-white" strokeWidth={2.5} />
                  </div>
                </div>
                <Input
                  value={s.name}
                  onChange={(e) => updateSpotType(s.id, { name: e.target.value })}
                  className="h-8"
                  data-testid={`spot-type-name-${s.id}`}
                />
                <Select value={s.icon} onValueChange={(v) => updateSpotType(s.id, { icon: v as SpotIconKey })}>
                  <SelectTrigger className="h-8" data-testid={`spot-type-icon-${s.id}`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SPOT_ICON_KEYS.map((k) => {
                      const I = SPOT_ICONS[k];
                      return (
                        <SelectItem key={k} value={k}>
                          <div className="flex items-center gap-2">
                            <I className="h-3.5 w-3.5" /> <span className="capitalize">{k}</span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                <Input
                  type="color"
                  value={s.color}
                  onChange={(e) => updateSpotType(s.id, { color: e.target.value })}
                  className="h-8 w-full p-0.5 cursor-pointer"
                  data-testid={`spot-type-color-${s.id}`}
                />
                <Button
                  variant="ghost" size="sm"
                  onClick={() => removeSpotType(s.id)}
                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                  data-testid={`spot-type-delete-${s.id}`}
                  aria-label={`Delete ${s.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Background Library */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-lg">Map Background Library</CardTitle>
              <CardDescription>Backgrounds you've used in the Map Maker are saved here and can be re-applied to other maps. New uploads from the Map Maker are added automatically.</CardDescription>
            </div>
            <Badge variant="outline">{backgrounds.length}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {backgrounds.length === 0 ? (
            <div className="rounded-md border border-dashed border-border p-6 text-center">
              <ImageIcon className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                No backgrounds yet. Upload a map image from the <strong>Map Maker</strong> and it'll appear here for reuse.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {backgrounds.map((bg) => (
                <div key={bg.id} className="group relative rounded-md border border-border overflow-hidden bg-muted">
                  <img src={bg.image} alt={bg.name} className="w-full h-32 object-cover" />
                  <div className="p-2">
                    <div className="text-xs font-medium truncate" title={bg.name}>{bg.name}</div>
                    <div className="text-[10px] text-muted-foreground">{bg.imgWidth} × {bg.imgHeight}</div>
                  </div>
                  <Button
                    variant="destructive" size="sm"
                    className="absolute top-1 right-1 h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => removeBackground(bg.id)}
                    data-testid={`bg-delete-${bg.id}`}
                    aria-label={`Remove ${bg.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />
      <p className="text-xs text-muted-foreground">
        Cemetery configuration is stored in your browser. In production this data lives on the cemetery's account.
      </p>
    </div>
  );
}

function isLight(hex: string): boolean {
  const c = hex.replace("#", "");
  if (c.length < 6) return true;
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150;
}
