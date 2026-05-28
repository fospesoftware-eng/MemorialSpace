/**
 * Seeds the public memorial store with demo products across flowers, urns,
 * headstones, and care services. Idempotent — safe to re-run; upserts by
 * product name so duplicates aren't created.
 *
 * Run with: pnpm --filter @workspace/scripts run seed-store
 */
import { db, productsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

function aiImage(prompt: string, seed: number): string {
  const encoded = encodeURIComponent(prompt);
  return `https://image.pollinations.ai/prompt/${encoded}?width=1400&height=1000&model=flux&seed=${seed}&nologo=true`;
}

const DEMO_PRODUCTS = [
  // Flowers
  {
    name: "White Rose Memorial Bouquet",
    description: "12 long-stem white roses hand-tied with satin ribbon. Delivered fresh to the gravesite.",
    category: "flowers" as const,
    price: 49.99,
    imageUrl: aiImage("studio product photo of a white rose memorial bouquet with satin ribbon on a neutral stone surface, soft natural light, photorealistic", 101),
    inStock: true,
    stockCount: 50,
  },
  {
    name: "Sympathy Lilies Arrangement",
    description: "Elegant white lilies with eucalyptus and baby's breath in a ceramic vase.",
    category: "flowers" as const,
    price: 79.99,
    imageUrl: aiImage("elegant sympathy lilies arrangement in ceramic vase, memorial tribute floral product photography, clean background, photorealistic", 102),
    inStock: true,
    stockCount: 30,
  },
  {
    name: "White Chrysanthemum Wreath",
    description: "Traditional circular wreath of white chrysanthemums — a dignified tribute for any memorial.",
    category: "flowers" as const,
    price: 89.99,
    imageUrl: aiImage("white chrysanthemum memorial wreath standing upright, respectful funeral product shot, realistic details, soft shadows", 103),
    inStock: true,
    stockCount: 20,
  },
  {
    name: "Forget-Me-Not Memory Basket",
    description: "Delicate forget-me-nots nestled in a woven willow basket with moss.",
    category: "flowers" as const,
    price: 59.99,
    imageUrl: aiImage("forget me not flowers in a woven willow memory basket with moss, memorial gift product image, realistic", 104),
    inStock: true,
    stockCount: 40,
  },
  // Urns
  {
    name: "Classic Bronze Urn",
    description: "Hand-cast solid bronze urn with brushed finish and engraved nameplate. Holds up to 200 cubic inches.",
    category: "urns" as const,
    price: 249.99,
    imageUrl: aiImage("classic bronze cremation urn with brushed metal finish and engraved plate, premium product photography, photorealistic", 201),
    inStock: true,
    stockCount: 15,
  },
  {
    name: "Biodegradable Earth Urn",
    description: "Eco-friendly sand and gelatin urn designed for water or earth burial. Dissolves naturally within 48 hours.",
    category: "urns" as const,
    price: 129.99,
    imageUrl: aiImage("biodegradable eco urn made of natural sand material, modern memorial product photo on neutral background, realistic", 202),
    inStock: true,
    stockCount: 25,
  },
  {
    name: "Marble Keepsake Urn",
    description: "Carrara marble mini urn for sharing ashes among family. Sealed brass threaded lid.",
    category: "urns" as const,
    price: 189.99,
    imageUrl: aiImage("small carrara marble keepsake urn with brass lid, close up studio product image, realistic stone texture", 203),
    inStock: true,
    stockCount: 18,
  },
  // Headstones & Memorials
  {
    name: "Granite Headstone — Classic Gray",
    description: "Polished gray granite headstone with beveled edges. Includes custom engraving of name and dates.",
    category: "other" as const,
    price: 899.99,
    imageUrl: aiImage("polished gray granite headstone with engraved text in cemetery display setting, product-focused composition, photorealistic", 301),
    inStock: true,
    stockCount: 8,
  },
  {
    name: "Bronze Memorial Plaque",
    description: "Cast bronze wall or ground plaque with UV-resistant lacquer. 8×10 inches, mounting hardware included.",
    category: "other" as const,
    price: 349.99,
    imageUrl: aiImage("cast bronze memorial plaque with mounting hardware on stone background, high detail product photo, realistic", 302),
    inStock: true,
    stockCount: 12,
  },
  {
    name: "Upright Marble Monument",
    description: "Statuary white marble upright monument with carved floral relief. Full installation coordination included.",
    category: "other" as const,
    price: 1499.99,
    imageUrl: aiImage("upright white marble monument with carved floral relief, premium memorial product image, realistic lighting", 303),
    inStock: true,
    stockCount: 5,
  },
  // Services
  {
    name: "Weekly Grave Care Plan",
    description: "Ongoing maintenance: trimming, debris removal, flower refreshing, and seasonal decorations.",
    category: "services" as const,
    price: 29.99,
    imageUrl: aiImage("professional grave care service scene with caretaker cleaning headstone and fresh flowers, respectful realistic photo", 401),
    inStock: true,
    stockCount: 100,
  },
  {
    name: "Memorial Photography Session",
    description: "Professional photographer captures the memorial site, floral tributes, and family portraits.",
    category: "services" as const,
    price: 149.99,
    imageUrl: aiImage("memorial photography service concept with camera and framed floral gravesite in background, realistic professional look", 402),
    inStock: true,
    stockCount: 20,
  },
  {
    name: "Headstone Cleaning & Restoration",
    description: "Gentle non-abrasive cleaning, moss removal, and minor repair of weathered inscriptions.",
    category: "services" as const,
    price: 199.99,
    imageUrl: aiImage("headstone cleaning and restoration service in progress, before and after style visual, realistic respectful scene", 403),
    inStock: true,
    stockCount: 15,
  },
];

async function main(): Promise<void> {
  console.log("Seeding memorial store products…");

  // Remove old demo products whose names no longer match the current set
  const keepNames = DEMO_PRODUCTS.map((p) => p.name);
  await db
    .delete(productsTable)
    .where(sql`${productsTable.name} NOT IN (${sql.join(keepNames.map((n) => sql.raw(`'${n.replace(/'/g, "''")}'`)))})`);

  for (const p of DEMO_PRODUCTS) {
    const existing = await db
      .select()
      .from(productsTable)
      .where(eq(productsTable.name, p.name))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(productsTable)
        .set(p)
        .where(eq(productsTable.id, existing[0].id));
      console.log(`  • updated: ${p.name}`);
    } else {
      await db.insert(productsTable).values(p);
      console.log(`  • inserted: ${p.name}`);
    }
  }

  console.log("Store seed complete.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
