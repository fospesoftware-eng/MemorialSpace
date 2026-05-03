/**
 * Seeds the funeral marketplace with one vendor per lifecycle category,
 * each with services (mix of fixed/range/subscription/quote pricing) and
 * accepted/completed requests carrying real revenue. Drives the vendor
 * dashboard's revenue/customers/top-services widgets.
 *
 * Idempotent — safe to re-run.  Run with:
 *   pnpm --filter @workspace/scripts run seed-vendors
 */
import bcrypt from "bcryptjs";
import {
  db,
  marketplaceVendorsTable,
  vendorServicesTable,
  vendorRequestsTable,
  type NewVendorService,
  type NewVendorRequest,
  type FuneralCategory,
} from "@workspace/db";
import { eq } from "drizzle-orm";

const PASSWORD = "Vendor2026!";

interface SeedService {
  name: string;
  description: string;
  pricingModel: "fixed" | "range" | "subscription" | "quote";
  priceFrom?: number;
  priceTo?: number;
  priceAmount?: number;
  billingCadence?: "one-time" | "monthly" | "quarterly" | "yearly";
}

interface SeedRequest {
  serviceIdx: number;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  deceasedName?: string;
  message: string;
  status: "accepted" | "completed";
  quotedAmount: number;
  paidAmount: number;
  paymentStatus: "unpaid" | "invoiced" | "paid" | "refunded";
  isRecurring?: boolean;
  monthsAgo?: number;
}

interface SeedVendor {
  email: string;
  slug: string;
  businessName: string;
  description: string;
  category: FuneralCategory;
  contactName: string;
  contactPhone: string;
  serviceAreas: string[];
  services: SeedService[];
  requests: SeedRequest[];
}

const VENDORS: SeedVendor[] = [
  {
    email: "hello@solacefuneral.com",
    slug: "solace-funeral-home",
    businessName: "Solace Funeral Home",
    description:
      "Family-owned funeral planning since 1962. End-to-end services including transport, ceremony coordination, and reception venues.",
    category: "funeral-services",
    contactName: "Margaret Solace",
    contactPhone: "(206) 555-0142",
    serviceAreas: ["Seattle", "Bellevue", "Tacoma"],
    services: [
      { name: "Traditional funeral package", description: "Full-service funeral with viewing, ceremony, and reception coordination.", pricingModel: "fixed", priceAmount: 6500 },
      { name: "Direct cremation", description: "Simple, dignified cremation including transport and certified urn.", pricingModel: "fixed", priceAmount: 1850 },
      { name: "Memorial service planning", description: "Custom memorial ceremony at your venue of choice.", pricingModel: "range", priceFrom: 2500, priceTo: 5500 },
      { name: "Bespoke celebration of life", description: "Personalised tribute event — venue, catering coordination, AV.", pricingModel: "quote" },
    ],
    requests: [
      { serviceIdx: 0, customerName: "Eleanor Park", customerEmail: "eleanor.park@example.com", customerPhone: "(206) 555-7733", deceasedName: "Robert Park", message: "Need full traditional service for my father next Saturday.", status: "completed", quotedAmount: 6500, paidAmount: 6500, paymentStatus: "paid", monthsAgo: 0 },
      { serviceIdx: 1, customerName: "James Wu", customerEmail: "james.wu@example.com", deceasedName: "Mei Wu", message: "Mother passed last week, requesting direct cremation.", status: "completed", quotedAmount: 1850, paidAmount: 1850, paymentStatus: "paid", monthsAgo: 1 },
      { serviceIdx: 0, customerName: "Eleanor Park", customerEmail: "eleanor.park@example.com", deceasedName: "Margaret Park", message: "Repeat customer — service for mother.", status: "completed", quotedAmount: 6800, paidAmount: 6800, paymentStatus: "paid", monthsAgo: 2 },
      { serviceIdx: 2, customerName: "Sarah Lindgren", customerEmail: "sarah.l@example.com", deceasedName: "Erik Lindgren", message: "Memorial at our family home, ~80 guests.", status: "accepted", quotedAmount: 4200, paidAmount: 2100, paymentStatus: "invoiced", monthsAgo: 0 },
      { serviceIdx: 3, customerName: "David Reyes", customerEmail: "david.r@example.com", deceasedName: "Carmen Reyes", message: "Looking for a celebration of life at the lake — please quote.", status: "accepted", quotedAmount: 8500, paidAmount: 0, paymentStatus: "invoiced", monthsAgo: 0 },
    ],
  },
  {
    email: "father.aldridge@stmarysparish.org",
    slug: "father-aldridge-officiant",
    businessName: "Father Aldridge — Officiant Services",
    description:
      "Catholic and ecumenical funeral rites, graveside prayer, and yearly memorial blessings. 30 years' experience across the Pacific Northwest.",
    category: "religious",
    contactName: "Father Michael Aldridge",
    contactPhone: "(360) 555-0188",
    serviceAreas: ["Seattle", "Olympia", "Everett"],
    services: [
      { name: "Funeral mass officiant", description: "Full Catholic funeral mass at parish or graveside.", pricingModel: "fixed", priceAmount: 450 },
      { name: "Graveside prayer service", description: "30-minute committal prayer service.", pricingModel: "fixed", priceAmount: 250 },
      { name: "Annual memorial blessing", description: "Yearly graveside blessing on the anniversary.", pricingModel: "subscription", priceAmount: 175, billingCadence: "yearly" },
      { name: "Custom interfaith ceremony", description: "Tailored interfaith service drawing from multiple traditions.", pricingModel: "quote" },
    ],
    requests: [
      { serviceIdx: 0, customerName: "Theresa O'Connor", customerEmail: "theresa.oc@example.com", deceasedName: "Patrick O'Connor", message: "Funeral mass next Tuesday.", status: "completed", quotedAmount: 450, paidAmount: 450, paymentStatus: "paid", monthsAgo: 0 },
      { serviceIdx: 1, customerName: "Andre Becker", customerEmail: "andre.becker@example.com", deceasedName: "Hans Becker", message: "Graveside service on Saturday.", status: "completed", quotedAmount: 250, paidAmount: 250, paymentStatus: "paid", monthsAgo: 1 },
      { serviceIdx: 2, customerName: "Theresa O'Connor", customerEmail: "theresa.oc@example.com", deceasedName: "Patrick O'Connor", message: "Annual blessing — please continue yearly.", status: "accepted", quotedAmount: 175, paidAmount: 175, paymentStatus: "paid", isRecurring: true, monthsAgo: 0 },
      { serviceIdx: 2, customerName: "Marie Chen", customerEmail: "marie.chen@example.com", deceasedName: "Wei Chen", message: "Yearly anniversary blessing.", status: "accepted", quotedAmount: 175, paidAmount: 175, paymentStatus: "paid", isRecurring: true, monthsAgo: 0 },
      { serviceIdx: 0, customerName: "Sophie Allen", customerEmail: "sophie.allen@example.com", deceasedName: "George Allen", message: "Need an officiant for funeral mass.", status: "completed", quotedAmount: 450, paidAmount: 450, paymentStatus: "paid", monthsAgo: 3 },
    ],
  },
  {
    email: "info@evergreenmemorialcare.com",
    slug: "evergreen-memorial-care",
    businessName: "Evergreen Memorial Care",
    description:
      "Year-round grave maintenance subscriptions: weekly cleaning, seasonal flowers, and headstone polishing. Photos sent monthly.",
    category: "maintenance",
    contactName: "Daniel Park",
    contactPhone: "(425) 555-0123",
    serviceAreas: ["Seattle", "Bellevue", "Redmond", "Kirkland"],
    services: [
      { name: "Essential care plan", description: "Monthly grave cleaning, weeding, fresh flowers, photo update.", pricingModel: "subscription", priceAmount: 49, billingCadence: "monthly" },
      { name: "Premium care plan", description: "Bi-weekly visits, seasonal floral arrangements, full landscaping.", pricingModel: "subscription", priceAmount: 129, billingCadence: "monthly" },
      { name: "Seasonal headstone polish", description: "Quarterly deep clean and polish of granite or marble.", pricingModel: "subscription", priceAmount: 85, billingCadence: "quarterly" },
      { name: "One-time grave restoration", description: "Restore a long-neglected grave to pristine condition.", pricingModel: "range", priceFrom: 250, priceTo: 800 },
    ],
    requests: [
      { serviceIdx: 0, customerName: "Linda Sato", customerEmail: "linda.sato@example.com", deceasedName: "Hiroshi Sato", message: "Sign me up for monthly maintenance.", status: "accepted", quotedAmount: 49, paidAmount: 49, paymentStatus: "paid", isRecurring: true, monthsAgo: 0 },
      { serviceIdx: 0, customerName: "Linda Sato", customerEmail: "linda.sato@example.com", deceasedName: "Hiroshi Sato", message: "Continued maintenance.", status: "completed", quotedAmount: 49, paidAmount: 49, paymentStatus: "paid", isRecurring: true, monthsAgo: 1 },
      { serviceIdx: 0, customerName: "Linda Sato", customerEmail: "linda.sato@example.com", deceasedName: "Hiroshi Sato", message: "Continued maintenance.", status: "completed", quotedAmount: 49, paidAmount: 49, paymentStatus: "paid", isRecurring: true, monthsAgo: 2 },
      { serviceIdx: 1, customerName: "Robert Hayes", customerEmail: "robert.hayes@example.com", deceasedName: "Anna Hayes", message: "Premium plan for my wife's grave.", status: "accepted", quotedAmount: 129, paidAmount: 129, paymentStatus: "paid", isRecurring: true, monthsAgo: 0 },
      { serviceIdx: 1, customerName: "Robert Hayes", customerEmail: "robert.hayes@example.com", deceasedName: "Anna Hayes", message: "Premium plan continued.", status: "completed", quotedAmount: 129, paidAmount: 129, paymentStatus: "paid", isRecurring: true, monthsAgo: 1 },
      { serviceIdx: 1, customerName: "Robert Hayes", customerEmail: "robert.hayes@example.com", deceasedName: "Anna Hayes", message: "Premium plan continued.", status: "completed", quotedAmount: 129, paidAmount: 129, paymentStatus: "paid", isRecurring: true, monthsAgo: 2 },
      { serviceIdx: 1, customerName: "Robert Hayes", customerEmail: "robert.hayes@example.com", deceasedName: "Anna Hayes", message: "Premium plan continued.", status: "completed", quotedAmount: 129, paidAmount: 129, paymentStatus: "paid", isRecurring: true, monthsAgo: 3 },
      { serviceIdx: 3, customerName: "Patricia Wong", customerEmail: "patricia.wong@example.com", deceasedName: "James Wong", message: "Family plot needs full restoration.", status: "completed", quotedAmount: 650, paidAmount: 650, paymentStatus: "paid", monthsAgo: 4 },
      { serviceIdx: 2, customerName: "Frank Murphy", customerEmail: "frank.m@example.com", deceasedName: "Bridget Murphy", message: "Quarterly polish for granite headstone.", status: "accepted", quotedAmount: 85, paidAmount: 85, paymentStatus: "paid", isRecurring: true, monthsAgo: 0 },
    ],
  },
  {
    email: "studio@heritagestoneworks.com",
    slug: "heritage-stoneworks",
    businessName: "Heritage Stoneworks",
    description:
      "Custom granite and marble headstones designed and carved in our Seattle studio. On-site installation included.",
    category: "headstone",
    contactName: "Anna Petrova",
    contactPhone: "(206) 555-0177",
    serviceAreas: ["Seattle", "Tacoma", "Olympia"],
    services: [
      { name: "Upright granite headstone", description: "30\" × 24\" upright headstone with custom engraving and installation.", pricingModel: "range", priceFrom: 2400, priceTo: 4800 },
      { name: "Flat marker", description: "24\" × 12\" flush bronze or granite marker.", pricingModel: "fixed", priceAmount: 950 },
      { name: "Custom monument design", description: "Sculpted or columned monument designed to your specifications.", pricingModel: "quote" },
      { name: "Engraving update", description: "Add a name, date, or short epitaph to an existing stone.", pricingModel: "fixed", priceAmount: 425 },
    ],
    requests: [
      { serviceIdx: 0, customerName: "Carla Bennett", customerEmail: "carla.b@example.com", deceasedName: "Henry Bennett", message: "Need an upright granite stone with a custom rose engraving.", status: "completed", quotedAmount: 3200, paidAmount: 3200, paymentStatus: "paid", monthsAgo: 1 },
      { serviceIdx: 0, customerName: "Marcus Lee", customerEmail: "marcus.lee@example.com", deceasedName: "Susan Lee", message: "Standard upright with bilingual inscription.", status: "completed", quotedAmount: 3850, paidAmount: 3850, paymentStatus: "paid", monthsAgo: 2 },
      { serviceIdx: 1, customerName: "Diana Cole", customerEmail: "diana.c@example.com", deceasedName: "Walter Cole", message: "Flat marker for my father.", status: "completed", quotedAmount: 950, paidAmount: 950, paymentStatus: "paid", monthsAgo: 3 },
      { serviceIdx: 2, customerName: "Vince Russo", customerEmail: "vince.r@example.com", deceasedName: "Maria Russo", message: "Looking for a sculpted angel monument — please send a quote.", status: "accepted", quotedAmount: 12500, paidAmount: 4000, paymentStatus: "invoiced", monthsAgo: 0 },
      { serviceIdx: 3, customerName: "Ellen Park", customerEmail: "ellen.park@example.com", deceasedName: "Joseph Park", message: "Add my mother's name to existing family stone.", status: "accepted", quotedAmount: 425, paidAmount: 425, paymentStatus: "paid", monthsAgo: 0 },
    ],
  },
  {
    email: "studio@everbloomflorals.com",
    slug: "everbloom-florals",
    businessName: "Everbloom Memorial Florals",
    description:
      "Annual remembrance flowers, anniversary tribute candles, and personalised memorial keepsake boxes — delivered yearly so you never miss a date.",
    category: "remembrance",
    contactName: "Maya Singh",
    contactPhone: "(425) 555-0166",
    serviceAreas: ["Seattle", "Bellevue", "Tacoma", "Everett"],
    services: [
      { name: "Anniversary flower delivery", description: "Hand-arranged seasonal bouquet delivered to the grave on the anniversary.", pricingModel: "subscription", priceAmount: 95, billingCadence: "yearly" },
      { name: "Quarterly tribute candles", description: "Hand-poured beeswax candles delivered quarterly with the deceased's name engraved.", pricingModel: "subscription", priceAmount: 65, billingCadence: "quarterly" },
      { name: "Memorial keepsake box", description: "One-time engraved keepsake box with photo, locket, and dried flowers.", pricingModel: "fixed", priceAmount: 285 },
      { name: "Custom remembrance package", description: "Bespoke yearly tribute — flowers, music, and a hand-written note.", pricingModel: "quote" },
    ],
    requests: [
      { serviceIdx: 0, customerName: "Hannah Brooks", customerEmail: "hannah.b@example.com", deceasedName: "David Brooks", message: "Yearly anniversary flowers.", status: "accepted", quotedAmount: 95, paidAmount: 95, paymentStatus: "paid", isRecurring: true, monthsAgo: 0 },
      { serviceIdx: 0, customerName: "Olivia Tran", customerEmail: "olivia.tran@example.com", deceasedName: "Linh Tran", message: "Yearly bouquet for mum.", status: "accepted", quotedAmount: 95, paidAmount: 95, paymentStatus: "paid", isRecurring: true, monthsAgo: 1 },
      { serviceIdx: 1, customerName: "Hannah Brooks", customerEmail: "hannah.b@example.com", deceasedName: "David Brooks", message: "Add quarterly candles too.", status: "completed", quotedAmount: 65, paidAmount: 65, paymentStatus: "paid", isRecurring: true, monthsAgo: 2 },
      { serviceIdx: 1, customerName: "Hannah Brooks", customerEmail: "hannah.b@example.com", deceasedName: "David Brooks", message: "Quarterly candles continued.", status: "completed", quotedAmount: 65, paidAmount: 65, paymentStatus: "paid", isRecurring: true, monthsAgo: 5 },
      { serviceIdx: 2, customerName: "Greg Thompson", customerEmail: "greg.t@example.com", deceasedName: "Janet Thompson", message: "Keepsake box for the children.", status: "completed", quotedAmount: 285, paidAmount: 285, paymentStatus: "paid", monthsAgo: 3 },
      { serviceIdx: 3, customerName: "Priya Mehta", customerEmail: "priya.m@example.com", deceasedName: "Arun Mehta", message: "Looking for a custom yearly tribute — flowers, music, candles.", status: "accepted", quotedAmount: 450, paidAmount: 0, paymentStatus: "invoiced", isRecurring: true, monthsAgo: 0 },
    ],
  },
];

function monthsAgoDate(months: number): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d;
}

async function main() {
  console.log("[seed-vendors] starting");
  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  for (const v of VENDORS) {
    // Remove any pre-existing vendor with the same slug but a different
    // email (left over from older seeds) so the new account can take over.
    const [bySlug] = await db
      .select()
      .from(marketplaceVendorsTable)
      .where(eq(marketplaceVendorsTable.slug, v.slug))
      .limit(1);
    if (bySlug && bySlug.email !== v.email.toLowerCase()) {
      await db.delete(marketplaceVendorsTable).where(eq(marketplaceVendorsTable.id, bySlug.id));
      console.log(`  · removed stale vendor with slug ${v.slug}`);
    }

    // Upsert vendor by email.
    const [existing] = await db
      .select()
      .from(marketplaceVendorsTable)
      .where(eq(marketplaceVendorsTable.email, v.email.toLowerCase()))
      .limit(1);

    let vendorId: number;
    if (existing) {
      vendorId = existing.id;
      await db
        .update(marketplaceVendorsTable)
        .set({
          slug: v.slug,
          businessName: v.businessName,
          description: v.description,
          contactName: v.contactName,
          contactPhone: v.contactPhone,
          categories: [v.category],
          serviceAreas: v.serviceAreas,
          isPublished: true,
          status: "active",
          updatedAt: new Date(),
        })
        .where(eq(marketplaceVendorsTable.id, vendorId));
      console.log(`  ↻ updated vendor ${v.businessName}`);
    } else {
      const [created] = await db
        .insert(marketplaceVendorsTable)
        .values({
          email: v.email.toLowerCase(),
          passwordHash,
          slug: v.slug,
          businessName: v.businessName,
          description: v.description,
          contactName: v.contactName,
          contactPhone: v.contactPhone,
          categories: [v.category],
          serviceAreas: v.serviceAreas,
          isPublished: true,
          status: "active",
        })
        .returning({ id: marketplaceVendorsTable.id });
      vendorId = created.id;
      console.log(`  ✓ created vendor ${v.businessName}`);
    }

    // Wipe existing services + requests for a clean slate (idempotent).
    await db.delete(vendorRequestsTable).where(eq(vendorRequestsTable.vendorId, vendorId));
    await db.delete(vendorServicesTable).where(eq(vendorServicesTable.vendorId, vendorId));

    // Insert services and capture their ids in order.
    const serviceRows: NewVendorService[] = v.services.map((s, idx) => ({
      vendorId,
      name: s.name,
      description: s.description,
      pricingModel: s.pricingModel,
      priceFrom: s.priceFrom ?? null,
      priceTo: s.priceTo ?? null,
      priceAmount: s.priceAmount ?? null,
      billingCadence: s.billingCadence ?? "one-time",
      category: v.category,
      photos: [],
      isPublished: true,
      sortOrder: idx,
    }));
    const insertedServices = await db
      .insert(vendorServicesTable)
      .values(serviceRows)
      .returning({ id: vendorServicesTable.id });

    // Insert requests, mapping serviceIdx → real id.
    const requestRows: NewVendorRequest[] = v.requests.map((r) => {
      const createdAt = monthsAgoDate(r.monthsAgo ?? 0);
      return {
        vendorId,
        serviceId: insertedServices[r.serviceIdx]?.id ?? null,
        customerName: r.customerName,
        customerEmail: r.customerEmail.toLowerCase(),
        customerPhone: r.customerPhone ?? null,
        deceasedName: r.deceasedName ?? null,
        serviceLocation: null,
        message: r.message,
        status: r.status,
        vendorNotes: null,
        quotedAmount: r.quotedAmount,
        paidAmount: r.paidAmount,
        paymentStatus: r.paymentStatus,
        scheduledFor: null,
        isRecurring: r.isRecurring ?? false,
        respondedAt: createdAt,
        createdAt,
        updatedAt: createdAt,
      };
    });
    if (requestRows.length > 0) {
      await db.insert(vendorRequestsTable).values(requestRows);
    }

    console.log(
      `    + ${insertedServices.length} services, ${requestRows.length} requests`,
    );
  }

  console.log("[seed-vendors] done — all vendors use password:", PASSWORD);
  process.exit(0);
}

main().catch((err) => {
  console.error("[seed-vendors] failed", err);
  process.exit(1);
});
