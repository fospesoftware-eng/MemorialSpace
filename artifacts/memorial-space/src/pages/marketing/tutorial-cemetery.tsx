import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Building2, ArrowRight, KeyRound, LayoutDashboard, Map, Users2,
  Calendar, Wrench, Boxes, CalendarClock, Banknote, Receipt,
  QrCode, FileText, ShoppingBag, Globe, ShieldCheck, BookOpen,
} from "lucide-react";

type Step = {
  num: number;
  icon: typeof Map;
  title: string;
  body: string;
  bullets: string[];
  shot?: { src: string; alt: string };
  mock?: { title: string; rows: { label: string; value: string }[] };
};

const steps: Step[] = [
  {
    num: 1,
    icon: KeyRound,
    title: "Sign in to your operator console",
    body:
      "Visit /sign-in/cemetery and use the credentials your administrator created. To explore without committing, click the green “Instant sign-in” chip on the demo card — it autofills the demo cemetery account so you can click around safely.",
    bullets: [
      "URL: /sign-in/cemetery",
      "Demo button autofills ops@riversidememorial.com / Cemetery2026!",
      "“Keep me signed in” keeps your session for 30 days on this device.",
    ],
    shot: { src: `${import.meta.env.BASE_URL}tutorial-assets/b2b-signin.jpg`, alt: "Cemetery operator sign-in page" },
  },
  {
    num: 2,
    icon: LayoutDashboard,
    title: "Get oriented on the dashboard",
    body:
      "After sign-in you land on the dashboard. The left sidebar groups the platform into Operations, Operations & Finance, Family-facing, Commerce, and Admin. The top tiles surface today's bookings, open work orders, occupancy %, and revenue this month.",
    bullets: [
      "Quick stats: occupancy, bookings today, open work orders, MTD revenue.",
      "Activity feed: recent burials, payments, tribute submissions awaiting moderation.",
      "Use the global search (top bar) to jump to any plot, person, or invoice by name.",
    ],
    mock: {
      title: "Dashboard tiles",
      rows: [
        { label: "Plots occupied", value: "1,284 / 1,500" },
        { label: "Bookings today", value: "4" },
        { label: "Open work orders", value: "12" },
        { label: "Revenue (MTD)", value: "$48,210" },
      ],
    },
  },
  {
    num: 3,
    icon: Map,
    title: "Set up your cemetery map & plots",
    body:
      "Open Operations → Map. Upload an aerial photo or scanned hand-drawn map and either trace plot polygons by hand or run the AI map maker to detect them automatically. Each plot has a status: available, reserved, occupied, or maintenance.",
    bullets: [
      "Sections (e.g., “Section A — Garden of Peace”) group plots and roll up reporting.",
      "Click a plot to set price, plot size, and link a burial record.",
      "Status changes propagate to the public Grave Search and customer checkout in real time.",
    ],
  },
  {
    num: 4,
    icon: Users2,
    title: "Add your team",
    body:
      "Open Admin → Team. Invite staff by email and assign one of five roles: Owner, Admin, Manager, Staff, or Viewer. Roles control which sidebar groups and write actions appear for that user.",
    bullets: [
      "Owners see everything including billing.",
      "Managers can run bookings, work orders, and accounting but not delete records.",
      "Viewers are read-only — perfect for groundskeepers who only need to see assignments.",
    ],
  },
  {
    num: 5,
    icon: Calendar,
    title: "Take your first booking",
    body:
      "Open Operations → Bookings → New booking. Pick a service type (interment, memorial service, niche placement), the family contact, the plot, and a date/time. The system blocks double-bookings on the same plot or the same crew.",
    bullets: [
      "Bookings auto-create a draft work order for the grounds crew.",
      "Email confirmation goes to the family with map directions.",
      "Drag the booking on the calendar view to reschedule.",
    ],
  },
  {
    num: 6,
    icon: BookOpen,
    title: "Log a burial record",
    body:
      "Open Operations → Burials → New burial. Enter the deceased's name, dates, biography, family relationships, and certificate number. Attach scanned source documents. The burial record is what powers the public memorial page and the Grave Search.",
    bullets: [
      "Records are searchable for the lifetime of the cemetery.",
      "Linking a plot is what turns the plot status to “occupied”.",
      "Toggle “Publish memorial page” to make a public-facing tribute page live.",
    ],
  },
  {
    num: 7,
    icon: Wrench,
    title: "Run a work order end-to-end",
    body:
      "Operations & Finance → Work Orders. Create an order, assign a staff member, then move it through Open → In progress → Completed using the buttons in the side drawer. Log labor hours, labor cost, materials cost, and completion notes — totals update live.",
    bullets: [
      "Side drawer shows the full status timeline and a comments thread.",
      "Cost fields autosave when you blur — no Save button needed.",
      "Marking “Completed” stamps a completion timestamp automatically.",
    ],
    mock: {
      title: "Work-order detail (example)",
      rows: [
        { label: "Title", value: "Repair fountain — Section B" },
        { label: "Status", value: "In progress" },
        { label: "Assigned to", value: "Marcus L." },
        { label: "Labor (4h × $35)", value: "$140.00" },
        { label: "Materials", value: "$72.18" },
        { label: "Total", value: "$212.18" },
      ],
    },
  },
  {
    num: 8,
    icon: Boxes,
    title: "Track your assets",
    body:
      "Operations & Finance → Assets. Catalog mowers, vehicles, irrigation systems, and other equipment. Each asset stores type, status, purchase date, and current value, and can be linked to maintenance schedules.",
    bullets: [
      "Search and filter by type and status.",
      "Status flags: active, in repair, retired.",
      "Linking an asset to a schedule makes its next-due date show in the asset row.",
    ],
  },
  {
    num: 9,
    icon: CalendarClock,
    title: "Set up recurring maintenance",
    body:
      "Operations & Finance → Maintenance. Create a recurring schedule (e.g., “Mow Section A every 14 days”). When a schedule is due, click Generate WO to create a pre-filled work order and advance the next-due date.",
    bullets: [
      "Cadence is in days — the system flags overdue schedules with a red ring.",
      "Each generation creates a real work order assigned to the linked asset.",
      "Pause a schedule by toggling its Active flag without losing history.",
    ],
  },
  {
    num: 10,
    icon: Banknote,
    title: "Capture expenses & approvals",
    body:
      "Operations & Finance → Expenses. Submit expenses against categories you define (Fuel, Repairs, Office, etc.). The header tiles roll up Total / Pending / Approved / Paid. Use the Approve, Reject, and Mark Paid actions to walk an expense through your finance workflow.",
    bullets: [
      "Categories live in the dialog — create them once, reuse forever.",
      "Vendor, amount, date, and notes are captured per expense.",
      "Status changes are journaled with timestamps for audit.",
    ],
  },
  {
    num: 11,
    icon: Receipt,
    title: "Send invoices & take payments",
    body:
      "Commerce → Accounting → Invoices. Build an invoice from a plot sale, service booking, or freeform line items. Send by email; the family pays online via card. Tax rates per jurisdiction are configured under Admin → Settings.",
    bullets: [
      "Line items can mix products (urns, plaques) and services.",
      "Customer ledger view rolls up everything one family has bought.",
      "A/R aging report lives in Commerce → Reports.",
    ],
  },
  {
    num: 12,
    icon: QrCode,
    title: "Print weatherproof QR memorial codes",
    body:
      "Family-facing → QR Codes. For any published memorial page, generate a high-resolution QR sticker or plate. Visitors scan it and instantly see photos, biography, and tributes — no app required.",
    bullets: [
      "Bulk-generate QR codes for whole sections at once.",
      "Each code is a permanent URL — replace stickers without changing the URL.",
      "Scan analytics show visits per memorial.",
    ],
  },
  {
    num: 13,
    icon: Globe,
    title: "Publish your public website",
    body:
      "Family-facing → Public Site. Pick a theme, set your logo and colors, and your turnkey website goes live on a memorialspace.app subdomain or your own domain. It includes Grave Search, Obituaries, and the Marketplace out of the box.",
    bullets: [
      "Custom domain via CNAME — TLS provisioned automatically.",
      "Edit copy and hero imagery without a developer.",
      "Hidden until you toggle “Public” — perfect for staging.",
    ],
  },
  {
    num: 14,
    icon: ShoppingBag,
    title: "Sell flowers, urns, and recurring care plans",
    body:
      "Commerce → Marketplace. List physical goods and recurring care services (e.g., monthly grave cleaning). Customers can order from a memorial page, the Marketplace, or directly via your website.",
    bullets: [
      "Inventory levels and reorder thresholds live alongside SKUs.",
      "Recurring care plans bill on a schedule via Stripe.",
      "Connect a vendor to drop-ship physical goods.",
    ],
  },
];

const faqs: { q: string; a: string }[] = [
  {
    q: "How long does onboarding take?",
    a: "A small cemetery (under 1,000 plots) typically goes live in a single afternoon — most of the time is spent uploading the map and importing existing burial records via CSV. Larger or multi-cemetery groups usually allocate 1–2 weeks with our success team.",
  },
  {
    q: "Can I import my existing plot map and burial spreadsheet?",
    a: "Yes. The AI map maker accepts a photo or PDF of your hand-drawn or CAD map and extracts plot polygons. Burial records and customer ledgers import via CSV using the templates under Admin → Data import.",
  },
  {
    q: "Who can see what in our team?",
    a: "Roles control everything. Owners and Admins see all modules including billing. Managers run day-to-day operations and accounting. Staff see assigned bookings and work orders. Viewers are read-only. You can mix and match — for example, a groundskeeper can be Staff for Work Orders but Viewer everywhere else.",
  },
  {
    q: "Do customers need to create an account to find a grave or pay?",
    a: "No. Grave Search, obituary reading, tribute submission, and one-time purchases are all guest-friendly. An account is only needed to manage a memorial page, view order history, or co-care for a family record.",
  },
  {
    q: "What happens to our data if we cancel?",
    a: "You can export every table (plots, burials, customers, invoices, work orders, expenses) as CSV at any time from Admin → Data export. After cancellation we retain encrypted backups for 90 days, then delete permanently.",
  },
  {
    q: "Is the platform compliant with privacy laws?",
    a: "Yes. We are SOC 2 Type II audited and process personal data under GDPR-compatible terms. The audit log captures every write to family records with actor, timestamp, and a structured detail blob — useful for both compliance and internal accountability.",
  },
  {
    q: "Can I run more than one cemetery from one account?",
    a: "Yes. The Enterprise plan supports multi-cemetery groups: one organization, many cemeteries, centralized billing and reporting, but per-cemetery branding, public website, and operations.",
  },
  {
    q: "How do recurring maintenance schedules generate work orders?",
    a: "Each schedule has a cadence (in days) and a next-due date. When you click Generate WO on a schedule (or on the Maintenance dashboard), the platform creates a real work order pre-filled with the schedule's title, type, and linked asset, and advances the schedule's next-due date by the cadence.",
  },
  {
    q: "Can I require expense approval before payment?",
    a: "Yes. Expenses follow a Pending → Approved → Paid (or Pending → Rejected) workflow. Only users with the Manage Finance permission see the Approve / Reject / Mark Paid buttons. Every transition is journaled.",
  },
  {
    q: "Do QR codes ever expire or break?",
    a: "Never. The URL behind a QR code is permanent. If you replace a weather-damaged sticker, the new sticker uses the same URL. The system also re-renders the QR PNG at print resolution any time you need a fresh sheet.",
  },
];

export default function TutorialCemeteryPage() {
  return (
    <div className="overflow-hidden">
      <section className="relative pt-20 pb-12 px-4">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[500px] w-[1000px] rounded-full bg-primary/10 blur-3xl" />
        </div>
        <div className="container mx-auto max-w-4xl text-center">
          <Badge variant="outline" className="mb-6 border-primary/30 bg-primary/5 text-primary px-4 py-1">
            <Building2 className="h-3 w-3 mr-2" />
            For cemetery owners & staff
          </Badge>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-5">
            Operator tutorial
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            A guided tour of every module, in the order a real cemetery uses them on day one. Follow along with the demo account or your own data.
          </p>
          <div className="mt-7 flex flex-wrap gap-3 justify-center">
            <Button asChild className="bg-primary hover:bg-primary/90"><Link href="/sign-in/cemetery">Open the operator console<ArrowRight className="h-4 w-4 ml-2" /></Link></Button>
            <Button asChild variant="outline"><Link href="/demo">View demo credentials</Link></Button>
          </div>
        </div>
      </section>

      <section className="py-8 px-4">
        <div className="container mx-auto max-w-5xl">
          <Card className="border-border/60 bg-card/40">
            <CardContent className="p-5 grid sm:grid-cols-3 gap-4 text-sm">
              <div className="flex items-start gap-3"><ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" /><div><p className="font-semibold">Demo-safe</p><p className="text-muted-foreground">The demo cemetery resets nightly — explore freely.</p></div></div>
              <div className="flex items-start gap-3"><FileText className="h-5 w-5 text-primary shrink-0 mt-0.5" /><div><p className="font-semibold">14 steps, ~45 minutes</p><p className="text-muted-foreground">Skip ahead — every step links to the relevant page.</p></div></div>
              <div className="flex items-start gap-3"><BookOpen className="h-5 w-5 text-primary shrink-0 mt-0.5" /><div><p className="font-semibold">FAQ at the end</p><p className="text-muted-foreground">Onboarding, imports, roles, compliance, and more.</p></div></div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="pb-16 px-4">
        <div className="container mx-auto max-w-5xl space-y-6">
          {steps.map((s) => (
            <Card key={s.num} className="border-border/60 bg-card overflow-hidden">
              <CardContent className="p-0">
                <div className="grid md:grid-cols-[1fr,1.1fr] gap-0">
                  <div className="p-7 md:p-8">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <s.icon className="h-5 w-5 text-primary" />
                      </div>
                      <div className="text-xs font-semibold uppercase tracking-widest text-primary">Step {String(s.num).padStart(2, "0")}</div>
                    </div>
                    <h2 className="text-2xl font-bold mb-3 leading-tight">{s.title}</h2>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-4">{s.body}</p>
                    <ul className="space-y-2">
                      {s.bullets.map((b) => (
                        <li key={b} className="text-sm flex gap-2 text-foreground/80">
                          <span className="text-primary mt-1.5 h-1 w-1 rounded-full bg-primary shrink-0" />
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="bg-muted/20 border-l border-border/40 p-5 flex items-center justify-center min-h-[260px]">
                    {s.shot ? (
                      <img src={s.shot.src} alt={s.shot.alt} className="rounded-lg border border-border/60 shadow-2xl max-h-[320px] w-full object-cover object-top" />
                    ) : s.mock ? (
                      <div className="w-full max-w-sm rounded-lg border border-border/60 bg-background/60 backdrop-blur p-5 shadow-xl">
                        <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-3 font-semibold">{s.mock.title}</div>
                        <div className="space-y-2.5">
                          {s.mock.rows.map((r) => (
                            <div key={r.label} className="flex justify-between gap-4 text-sm border-b border-border/40 pb-2 last:border-b-0 last:pb-0">
                              <span className="text-muted-foreground">{r.label}</span>
                              <span className="font-semibold tabular-nums text-right">{r.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center text-muted-foreground text-sm">
                        <s.icon className="h-12 w-12 mx-auto mb-3 opacity-30" />
                        Open the live console to see this screen on your data.
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="py-16 px-4 bg-card/30 border-y border-border/40">
        <div className="container mx-auto max-w-3xl">
          <div className="text-center mb-10">
            <Badge variant="outline" className="mb-4 border-primary/30 bg-primary/5 text-primary">FAQ</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Operator questions, answered</h2>
          </div>
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((f, i) => (
              <AccordionItem key={i} value={`faq-${i}`}>
                <AccordionTrigger className="text-left">{f.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      <section className="py-20 px-4">
        <div className="container mx-auto max-w-4xl">
          <Card className="relative overflow-hidden border-primary/30 bg-gradient-to-br from-primary/10 via-card to-[#d4a843]/5">
            <CardContent className="relative p-12 text-center">
              <h2 className="text-3xl font-bold mb-3">Ready to start your free trial?</h2>
              <p className="text-muted-foreground mb-7 max-w-xl mx-auto">14 days, no credit card. Bring a CSV of your plot inventory and we'll have you live the same day.</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button asChild size="lg" className="bg-primary hover:bg-primary/90 px-8"><Link href="/sign-in/cemetery">Start free trial<ArrowRight className="h-4 w-4 ml-2" /></Link></Button>
                <Button asChild size="lg" variant="outline" className="px-8"><Link href="/contact">Book a demo</Link></Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
