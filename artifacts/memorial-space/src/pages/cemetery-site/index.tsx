import { Switch, Route, useRoute } from "wouter";
import { usePublicSite } from "./api";
import { CemeterySiteLayout } from "./layout";
import { CemeterySiteHome } from "./home";
import { CemeterySiteFindGrave } from "./find-grave";
import { CemeterySiteMarketplace } from "./marketplace";
import { CemeterySiteProduct } from "./product";
import { CemeterySiteCart } from "./cart";
import { CemeterySiteSuccess } from "./success";
import { CemeterySiteMap } from "./map";
import { CemeterySiteMemorial } from "./memorial";
import { CemeterySiteMemorialEdit } from "./memorial-edit";

export function CemeterySiteRoutes({ slug }: { slug: string }) {
  const { data: site, isLoading, isError, error } = usePublicSite(slug);
  const [, productParams] = useRoute<{ productSlug: string }>("/marketplace/:productSlug");
  const [, orderParams] = useRoute<{ orderNumber: string }>("/order/:orderNumber");
  const [, memorialParams] = useRoute<{ code: string }>("/memorial/:code");

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "hsl(150 20% 97%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ color: "hsl(150 25% 25%)" }} className="text-sm">
          Loading…
        </div>
      </div>
    );
  }

  if (isError || !site) {
    const msg = error instanceof Error ? error.message : "";
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "hsl(0 0% 98%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
        }}
      >
        <div className="text-center max-w-md">
          <h1 className="text-3xl font-semibold mb-3">Site not found</h1>
          <p className="text-sm text-muted-foreground">
            We couldn't find a cemetery website at this address. The site may not be
            published yet, or the URL may be incorrect.
          </p>
          {msg ? <p className="text-xs text-muted-foreground/60 mt-4 font-mono">{msg}</p> : null}
        </div>
      </div>
    );
  }

  return (
    <CemeterySiteLayout slug={slug} site={site}>
      <Switch>
        <Route path="/">{() => <CemeterySiteHome slug={slug} site={site} />}</Route>
        <Route path="/find-grave">
          {() => <CemeterySiteFindGrave slug={slug} site={site} />}
        </Route>
        <Route path="/map">{() => <CemeterySiteMap slug={slug} site={site} />}</Route>
        <Route path="/memorial/:code/edit">
          {(p) => (
            <CemeterySiteMemorialEdit
              slug={slug}
              site={site}
              code={p.code ?? ""}
            />
          )}
        </Route>
        <Route path="/memorial/:code">
          {(p) => (
            <CemeterySiteMemorial
              slug={slug}
              site={site}
              code={p.code ?? memorialParams?.code ?? ""}
            />
          )}
        </Route>
        <Route path="/marketplace">
          {() => <CemeterySiteMarketplace slug={slug} site={site} />}
        </Route>
        <Route path="/marketplace/:productSlug">
          {(p) => (
            <CemeterySiteProduct
              slug={slug}
              site={site}
              productSlug={p.productSlug ?? productParams?.productSlug ?? ""}
            />
          )}
        </Route>
        <Route path="/cart">{() => <CemeterySiteCart slug={slug} site={site} />}</Route>
        <Route path="/order/:orderNumber">
          {(p) => (
            <CemeterySiteSuccess
              slug={slug}
              site={site}
              orderNumber={p.orderNumber ?? orderParams?.orderNumber ?? ""}
            />
          )}
        </Route>
        <Route>
          <div className="container mx-auto max-w-2xl px-4 py-20 text-center">
            <h1 className="text-3xl font-semibold mb-3">Page not found</h1>
          </div>
        </Route>
      </Switch>
    </CemeterySiteLayout>
  );
}
