import { useEffect, useMemo, useState } from "react";
import MapMaker from "@/pages/b2b/map-maker";

type CemeteryScopedMapMakerProps = {
  cemeteryId: number;
};

type CemeteryOption = {
  id: number;
  name: string;
};

const PENDING_MAP_KEY = "memorialspace.map-maker:__pending__";

export default function CemeteryScopedMapMaker({ cemeteryId }: CemeteryScopedMapMakerProps) {
  const [ready, setReady] = useState(false);
  const [cemeteryName, setCemeteryName] = useState<string | null>(null);

  const fallbackName = useMemo(
    () => `Cemetery ${cemeteryId} Map Project`,
    [cemeteryId],
  );

  useEffect(() => {
    let cancelled = false;

    async function prepareCemeteryMap() {
      let name = fallbackName;

      try {
        const res = await fetch("/api/organizations", { credentials: "include" });
        const data = res.ok ? await res.json() : [];
        const cemetery = Array.isArray(data)
          ? (data as CemeteryOption[]).find((item) => Number(item.id) === cemeteryId)
          : null;
        if (cemetery?.name) name = cemetery.name;
      } catch {
        // The editor can still open with the cemetery id even if the name lookup fails.
      }

      if (cancelled) return;

      setCemeteryName(name);
      localStorage.setItem(
        PENDING_MAP_KEY,
        JSON.stringify({
          doc: {
            name: `${name} Map Project`,
            cemeteryId,
            projectStatus: "draft",
            image: null,
            imgWidth: 1200,
            imgHeight: 800,
            plots: [],
            spots: [],
            updatedAt: Date.now(),
          },
        }),
      );
      setReady(true);
    }

    void prepareCemeteryMap();

    return () => {
      cancelled = true;
    };
  }, [cemeteryId, fallbackName]);

  if (!ready) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-background text-sm text-muted-foreground">
        Opening Map Maker for {cemeteryName ?? fallbackName}...
      </div>
    );
  }

  return <MapMaker />;
}
