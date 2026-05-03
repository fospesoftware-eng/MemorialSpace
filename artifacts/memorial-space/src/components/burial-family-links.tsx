/**
 * Family-link panel — lets a cemetery operator connect a burial record
 * to other burials in the same cemetery, lists existing links, and opens
 * a family-tree dialog for visual exploration.
 *
 * Sits inside the Plot detail sheet / Burial detail sheet under the main
 * <BurialDetails> card.
 */
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useListBurials, type Burial } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Heart, Plus, Trash2, Users, X } from "lucide-react";

const ORG_ID = 1;
const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");

const RELATIONSHIPS = ["parent", "child", "spouse", "sibling", "other"] as const;
type Relationship = (typeof RELATIONSHIPS)[number];

const RELATIONSHIP_LABEL: Record<Relationship, string> = {
  parent: "Parent",
  child: "Child",
  spouse: "Spouse",
  sibling: "Sibling",
  other: "Other",
};

type FamilyLinkRow = {
  linkId: number;
  relationship: Relationship;
  notes: string | null;
  relatedBurial: Burial;
};

type FamilyTreeResponse = {
  rootId: number;
  nodes: Burial[];
  edges: {
    id: number;
    fromBurialId: number;
    toBurialId: number;
    relationship: Relationship;
  }[];
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `Request failed (${res.status})`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

function familyKey(burialId: number) {
  return ["burial-family", burialId] as const;
}

function fmtLifespan(b: Burial): string {
  const dob = b.deceasedDob ? new Date(b.deceasedDob).getFullYear() : null;
  const dod = b.deceasedDod ? new Date(b.deceasedDod).getFullYear() : null;
  if (dob && dod) return `${dob}–${dod}`;
  if (dob) return `b. ${dob}`;
  if (dod) return `d. ${dod}`;
  return "";
}

export function BurialFamilyLinks({ burialId }: { burialId: number }) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [treeOpen, setTreeOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [pickedId, setPickedId] = useState<number | null>(null);
  const [rel, setRel] = useState<Relationship>("parent");
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: familyKey(burialId),
    queryFn: () =>
      api<{ burial: Burial; links: FamilyLinkRow[] }>(`/burials/${burialId}/family`),
  });

  // Cemetery-wide burial list for the picker — reuses the cached list query
  // already fetched by parent pages so this is usually a no-op fetch.
  const { data: allBurials } = useListBurials({ organizationId: ORG_ID });

  const candidates = useMemo(() => {
    if (!allBurials) return [];
    const linkedIds = new Set((data?.links ?? []).map((l) => l.relatedBurial.id));
    const term = search.trim().toLowerCase();
    return allBurials
      .filter((b) => b.id !== burialId && !linkedIds.has(b.id))
      .filter((b) => !term || b.deceasedName.toLowerCase().includes(term))
      .slice(0, 8);
  }, [allBurials, data?.links, burialId, search]);

  const create = useMutation({
    mutationFn: (input: { relatedBurialId: number; relationship: Relationship }) =>
      api(`/burials/${burialId}/family`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: familyKey(burialId) });
      setAdding(false);
      setSearch("");
      setPickedId(null);
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const remove = useMutation({
    mutationFn: (linkId: number) =>
      api(`/burials/family-links/${linkId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: familyKey(burialId) }),
  });

  const links = data?.links ?? [];

  return (
    <div className="rounded-lg border border-sidebar-border bg-sidebar-accent/30 overflow-hidden mt-3"
         data-testid="family-links-panel">
      <div className="flex items-center justify-between px-3 py-2 border-b border-sidebar-border/60">
        <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-semibold text-sidebar-foreground/70">
          <Heart className="h-3 w-3" />
          Family
          {links.length > 0 && (
            <Badge variant="secondary" className="text-[10px] ml-1">{links.length}</Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          {links.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-[11px] gap-1"
              onClick={() => setTreeOpen(true)}
              data-testid="family-tree-open"
            >
              <Users className="h-3 w-3" /> Tree
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-[11px] gap-1"
            onClick={() => { setAdding((v) => !v); setError(null); }}
            data-testid="family-link-add"
          >
            {adding ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
            {adding ? "Cancel" : "Link"}
          </Button>
        </div>
      </div>

      {/* ----- Add form ----- */}
      {adding && (
        <div className="px-3 py-2 border-b border-sidebar-border/60 space-y-2 bg-sidebar-accent/20">
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPickedId(null); }}
            placeholder="Search burials in this cemetery…"
            className="h-8 text-xs"
            data-testid="family-search-input"
          />
          {!pickedId && search.trim() && (
            <ul className="max-h-40 overflow-auto rounded-md border border-sidebar-border bg-sidebar text-xs"
                data-testid="family-search-results">
              {candidates.length === 0 ? (
                <li className="px-2 py-1.5 text-sidebar-foreground/60 italic">No matches</li>
              ) : (
                candidates.map((b) => (
                  <li key={b.id}>
                    <button
                      type="button"
                      onClick={() => { setPickedId(b.id); setSearch(b.deceasedName); }}
                      className="w-full text-left px-2 py-1.5 hover:bg-sidebar-accent flex items-center justify-between gap-2"
                      data-testid={`family-search-pick-${b.id}`}
                    >
                      <span className="truncate font-medium">{b.deceasedName}</span>
                      <span className="text-sidebar-foreground/50 text-[10px] tabular-nums shrink-0">
                        {fmtLifespan(b)}
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
          <div className="flex items-center gap-2">
            <Select value={rel} onValueChange={(v) => setRel(v as Relationship)}>
              <SelectTrigger className="h-8 text-xs flex-1" data-testid="family-relationship-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RELATIONSHIPS.map((r) => (
                  <SelectItem key={r} value={r} className="text-xs">
                    {RELATIONSHIP_LABEL[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              disabled={!pickedId || create.isPending}
              onClick={() => {
                if (!pickedId) return;
                create.mutate({ relatedBurialId: pickedId, relationship: rel });
              }}
              data-testid="family-link-save"
              className="h-8 text-xs"
            >
              {create.isPending ? "Saving…" : "Save link"}
            </Button>
          </div>
          <p className="text-[10px] text-sidebar-foreground/60">
            {pickedId
              ? `Linking as: this person's ${RELATIONSHIP_LABEL[rel].toLowerCase()}.`
              : "Pick someone above, then choose how they're related."}
          </p>
          {error && <p className="text-[11px] text-red-400" data-testid="family-link-error">{error}</p>}
        </div>
      )}

      {/* ----- List ----- */}
      <div className="px-3 py-2">
        {isLoading ? (
          <Skeleton className="h-12 rounded-md bg-sidebar-accent/40" />
        ) : links.length === 0 ? (
          <p className="text-[11px] italic text-sidebar-foreground/60 px-1 py-1">
            No family connections yet. Link a parent, child, spouse or sibling buried here to start a tree.
          </p>
        ) : (
          <ul className="space-y-1.5" data-testid="family-link-list">
            {links.map((l) => (
              <li
                key={l.linkId}
                className="flex items-center justify-between gap-2 rounded-md border border-sidebar-border bg-sidebar px-2 py-1.5"
                data-testid={`family-link-${l.linkId}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium truncate">{l.relatedBurial.deceasedName}</div>
                  <div className="text-[10px] text-sidebar-foreground/60 flex items-center gap-1.5">
                    <Badge variant="outline" className="text-[10px] py-0 px-1.5 capitalize">
                      {RELATIONSHIP_LABEL[l.relationship]}
                    </Badge>
                    <span className="tabular-nums">{fmtLifespan(l.relatedBurial)}</span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-sidebar-foreground/60 hover:text-red-400"
                  onClick={() => remove.mutate(l.linkId)}
                  aria-label={`Remove link to ${l.relatedBurial.deceasedName}`}
                  data-testid={`family-link-remove-${l.linkId}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <FamilyTreeDialog burialId={burialId} open={treeOpen} onOpenChange={setTreeOpen} />
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Family-tree dialog — fetches BFS up to 3 hops and lays the result out as a
 * vertical tree: ancestors above the root, descendants below, spouses inline,
 * siblings clustered alongside the root. The layout is intentionally simple
 * (SVG, no libraries) — good enough for the typical 5–25 person cemetery
 * family network without dragging in a graph library.
 * ------------------------------------------------------------------------- */

type LayoutNode = {
  burial: Burial;
  x: number;
  y: number;
  generation: number;
};

function buildLayout(tree: FamilyTreeResponse): {
  nodes: LayoutNode[];
  edges: { from: LayoutNode; to: LayoutNode; relationship: Relationship }[];
  width: number;
  height: number;
} {
  const nodeById = new Map(tree.nodes.map((n) => [n.id, n]));
  // Generation = signed distance from root along parent/child edges.
  // Spouses + siblings inherit their partner's generation.
  const gen = new Map<number, number>([[tree.rootId, 0]]);
  // BFS using parent/child edges to assign generations, then a second pass
  // for spouses/siblings.
  let changed = true;
  let guard = 0;
  while (changed && guard++ < 12) {
    changed = false;
    for (const e of tree.edges) {
      const a = gen.get(e.fromBurialId);
      const b = gen.get(e.toBurialId);
      if (a == null && b == null) continue;
      if (e.relationship === "parent") {
        // to is parent of from → parent generation = from − 1
        if (a != null && b == null) { gen.set(e.toBurialId, a - 1); changed = true; }
        if (b != null && a == null) { gen.set(e.fromBurialId, b + 1); changed = true; }
      } else if (e.relationship === "child") {
        if (a != null && b == null) { gen.set(e.toBurialId, a + 1); changed = true; }
        if (b != null && a == null) { gen.set(e.fromBurialId, b - 1); changed = true; }
      } else {
        // spouse / sibling / other → same generation
        if (a != null && b == null) { gen.set(e.toBurialId, a); changed = true; }
        if (b != null && a == null) { gen.set(e.fromBurialId, b); changed = true; }
      }
    }
  }
  // Anyone we never reached lands in the root's row.
  for (const n of tree.nodes) if (!gen.has(n.id)) gen.set(n.id, 0);

  // Group by generation, then horizontally position.
  const byGen = new Map<number, number[]>();
  for (const [id, g] of gen) {
    if (!byGen.has(g)) byGen.set(g, []);
    byGen.get(g)!.push(id);
  }
  const generations = Array.from(byGen.keys()).sort((a, b) => a - b);
  const ROW_H = 110;
  const COL_W = 180;
  const PAD_X = 40;
  const PAD_Y = 40;
  const maxRow = Math.max(...Array.from(byGen.values()).map((ids) => ids.length));
  const width = Math.max(420, PAD_X * 2 + maxRow * COL_W);
  const height = PAD_Y * 2 + generations.length * ROW_H;

  const layoutNodes: LayoutNode[] = [];
  const posById = new Map<number, LayoutNode>();
  for (let gi = 0; gi < generations.length; gi++) {
    const g = generations[gi]!;
    const ids = byGen.get(g)!;
    // Pin the root to the centre of its row.
    if (ids.includes(tree.rootId)) {
      ids.sort((a, b) => (a === tree.rootId ? -1 : b === tree.rootId ? 1 : 0));
    }
    const rowWidth = ids.length * COL_W;
    const startX = (width - rowWidth) / 2 + COL_W / 2;
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i]!;
      const burial = nodeById.get(id);
      if (!burial) continue;
      const node: LayoutNode = {
        burial,
        x: startX + i * COL_W,
        y: PAD_Y + gi * ROW_H + ROW_H / 2,
        generation: g,
      };
      layoutNodes.push(node);
      posById.set(id, node);
    }
  }

  const layoutEdges = tree.edges
    .map((e) => {
      const from = posById.get(e.fromBurialId);
      const to = posById.get(e.toBurialId);
      if (!from || !to) return null;
      return { from, to, relationship: e.relationship };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  return { nodes: layoutNodes, edges: layoutEdges, width, height };
}

function FamilyTreeDialog({
  burialId,
  open,
  onOpenChange,
}: {
  burialId: number;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["burial-family-tree", burialId],
    queryFn: () => api<FamilyTreeResponse>(`/burials/${burialId}/family-tree`),
    enabled: open,
  });

  const layout = useMemo(() => (data ? buildLayout(data) : null), [data]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" /> Family tree
          </DialogTitle>
          <DialogDescription>
            Up to three degrees of family from this burial, scoped to this cemetery.
          </DialogDescription>
        </DialogHeader>

        {isLoading || !layout ? (
          <Skeleton className="h-72 w-full" />
        ) : layout.nodes.length === 1 ? (
          <p className="text-sm italic text-muted-foreground py-8 text-center">
            No relatives linked yet — start adding family connections to see a tree.
          </p>
        ) : (
          <div className="overflow-auto rounded-md border bg-muted/30" data-testid="family-tree-svg-wrap">
            <svg
              width={layout.width}
              height={layout.height}
              viewBox={`0 0 ${layout.width} ${layout.height}`}
              className="block"
              data-testid="family-tree-svg"
            >
              {layout.edges.map((e, i) => {
                const stroke =
                  e.relationship === "spouse"
                    ? "#d4a843"
                    : e.relationship === "sibling"
                      ? "#9ca3af"
                      : "#40916c";
                const dashed = e.relationship === "spouse" || e.relationship === "sibling" || e.relationship === "other";
                return (
                  <line
                    key={i}
                    x1={e.from.x}
                    y1={e.from.y}
                    x2={e.to.x}
                    y2={e.to.y}
                    stroke={stroke}
                    strokeWidth={1.5}
                    strokeDasharray={dashed ? "4 3" : undefined}
                    opacity={0.85}
                  />
                );
              })}
              {layout.nodes.map((n) => {
                const isRoot = n.burial.id === burialId;
                return (
                  <g key={n.burial.id} transform={`translate(${n.x - 70} ${n.y - 24})`}>
                    <rect
                      width={140}
                      height={48}
                      rx={6}
                      ry={6}
                      fill={isRoot ? "#1b4332" : "#ffffff"}
                      stroke={isRoot ? "#d4a843" : "#cbd5e1"}
                      strokeWidth={isRoot ? 2 : 1}
                    />
                    <text
                      x={70}
                      y={20}
                      textAnchor="middle"
                      fontSize={12}
                      fontWeight={600}
                      fill={isRoot ? "#ffffff" : "#0f172a"}
                    >
                      {n.burial.deceasedName.length > 20
                        ? n.burial.deceasedName.slice(0, 18) + "…"
                        : n.burial.deceasedName}
                    </text>
                    <text
                      x={70}
                      y={36}
                      textAnchor="middle"
                      fontSize={10}
                      fill={isRoot ? "#d4a843" : "#64748b"}
                    >
                      {fmtLifespan(n.burial)}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        )}

        <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-1 flex-wrap">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4" style={{ background: "#40916c" }} /> parent / child
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 border-t border-dashed" style={{ borderColor: "#d4a843" }} /> spouse
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 border-t border-dashed" style={{ borderColor: "#9ca3af" }} /> sibling
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
