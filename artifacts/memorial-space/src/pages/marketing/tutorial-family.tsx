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
  Heart, Search, BookMarked, QrCode, MessageSquareQuote, ShoppingBag,
  UserPlus, Bell, ShieldCheck, ArrowRight, BookOpen, Camera,
} from "lucide-react";

type Step = {
  num: number;
  icon: typeof Search;
  title: string;
  body: string;
  bullets: string[];
  shot?: { src: string; alt: string };
  mock?: { title: string; rows: { label: string; value: string }[] };
};

const steps: Step[] = [
  {
    num: 1,
    icon: Search,
    title: "Find a loved one's grave",
    body:
      "From the home page, click “Find a Loved One” or visit /find. Type the name (full name works best) and press Search. Results show the cemetery, section, plot number, and a link to a memorial page if one is published.",
    bullets: [
      "Search works across every cemetery in the MemorialSpace network.",
      "Partial names are okay — “Mitchell” will surface every Mitchell.",
      "Click a result to open driving directions and the memorial page.",
    ],
    shot: { src: `${import.meta.env.BASE_URL}tutorial-assets/b2c-grave-search.jpg`, alt: "Grave search page on the public site" },
  },
  {
    num: 2,
    icon: BookMarked,
    title: "Read obituaries from your community",
    body:
      "Visit /find/obituaries to browse published obituaries from cemeteries you follow or in your area. Each entry shows the deceased's photo, dates, a written tribute, and a “shares” count from the community.",
    bullets: [
      "Sort by most recent or by most shared.",
      "Tap an obituary to read the full story and visit the memorial page.",
      "Share buttons let you post the obituary to social or send the link by email.",
    ],
    shot: { src: `${import.meta.env.BASE_URL}tutorial-assets/b2c-obituaries.jpg`, alt: "Obituaries listing page" },
  },
  {
    num: 3,
    icon: QrCode,
    title: "Scan a QR memorial at the gravesite",
    body:
      "Many MemorialSpace cemeteries post weatherproof QR codes at the headstone or niche. Open your phone's camera, point it at the QR, and tap the link that appears — the memorial page opens instantly. No app to install.",
    bullets: [
      "Memorial pages show photos, biography, dates, and tributes.",
      "Visit count and last-visit date are displayed for the family.",
      "Works on every modern phone (iOS 11+, Android 8+).",
    ],
  },
  {
    num: 4,
    icon: MessageSquareQuote,
    title: "Leave a tribute or memory",
    body:
      "On any published memorial page, scroll to the “Tributes” section, write your message, attach an optional photo, and submit. The cemetery's team moderates submissions and your tribute appears within 24 hours.",
    bullets: [
      "No account required to submit a tribute as a guest.",
      "Add your relationship (friend, colleague, classmate) to give it context.",
      "Family page co-owners can pin or feature your tribute at the top.",
    ],
    mock: {
      title: "Tribute submission",
      rows: [
        { label: "Your name", value: "(required)" },
        { label: "Relationship", value: "Optional" },
        { label: "Message", value: "Up to 2,000 chars" },
        { label: "Photo", value: "Optional, ≤ 10 MB" },
        { label: "Review", value: "Within 24 hours" },
      ],
    },
  },
  {
    num: 5,
    icon: UserPlus,
    title: "Create a family account",
    body:
      "Visit /sign-in/family and choose “Create account”. With an account you can co-care for a memorial page, save graves to revisit, place orders, and respond to incoming tributes. The Instant sign-in chip lets you tour the demo family account first.",
    bullets: [
      "Demo account: sarah.chen@email.com / Demo2026! (autofills via Instant sign-in).",
      "Sign in with Google, Apple, or email + password.",
      "Two-factor authentication available under Account → Security.",
    ],
    shot: { src: `${import.meta.env.BASE_URL}tutorial-assets/b2c-signin.jpg`, alt: "Family member sign-in page" },
  },
  {
    num: 6,
    icon: Heart,
    title: "Manage a memorial page you co-care for",
    body:
      "From your account, go to “My memorials”. For pages where the cemetery has granted you co-care access, you can edit the biography, upload photos, pin tributes, add events (anniversaries, services), and approve incoming submissions.",
    bullets: [
      "Up to 5 family co-owners per memorial page.",
      "All edits are version-controlled — restore any earlier version.",
      "Privacy toggles: public, link-only, or family-only.",
    ],
  },
  {
    num: 7,
    icon: Camera,
    title: "Upload photos and a slideshow",
    body:
      "On the memorial page, open the “Photos” tab and drag-drop up to 200 images. The platform builds a slideshow automatically, optimized for mobile. Tag people in photos to make them searchable across your family.",
    bullets: [
      "Supports JPG, PNG, HEIC up to 25 MB each.",
      "Faces are detected automatically — confirm or correct tags.",
      "Originals are kept; downscaled versions serve to visitors for fast loads.",
    ],
  },
  {
    num: 8,
    icon: ShoppingBag,
    title: "Order flowers, candles, or care services",
    body:
      "On a memorial page or in /shop, browse the cemetery's offerings — flowers, candles, plaques, urns, and recurring grave-care plans. Choose the placement date and pay securely. The cemetery's grounds team handles fulfillment.",
    bullets: [
      "Recurring care plans bill monthly or quarterly via Stripe.",
      "Photo confirmation is sent after each placement.",
      "Receipts and order history live under Account → Orders.",
    ],
  },
  {
    num: 9,
    icon: Bell,
    title: "Set anniversary & visit reminders",
    body:
      "From any saved memorial, toggle “Remind me” to receive a gentle email or push notification before birthdays, death anniversaries, and major holidays. Reminders are off by default and never sold or shared.",
    bullets: [
      "Choose how many days ahead to be reminded.",
      "Email, SMS (US/CA only), or app push.",
      "One-tap unsubscribe per memorial.",
    ],
  },
  {
    num: 10,
    icon: ShieldCheck,
    title: "Privacy & control over your data",
    body:
      "Account → Privacy lets you export all your data as a single download, delete tributes you've submitted, leave a co-care role, or close your account. Memorial page content is owned by the family — even if you leave, what you've shared stays unless you remove it.",
    bullets: [
      "Export includes tributes, orders, photos, and saved memorials.",
      "Account closure deletes your personal profile within 30 days.",
      "Memorial pages outlive accounts — they're maintained by the cemetery.",
    ],
  },
];

const faqs: { q: string; a: string }[] = [
  {
    q: "Do I need to create an account to find a grave?",
    a: "No. Grave Search and obituary reading are free and require no account. You only need an account to manage a memorial page, place orders, or set reminders.",
  },
  {
    q: "I scanned a QR code but nothing happened — what should I do?",
    a: "Make sure your camera app or QR reader is pointed at the full code with adequate lighting. If the link opens but the page is blank, check your phone has a working internet connection. If the issue persists, the cemetery may have unpublished the memorial — contact them or use Grave Search by name instead.",
  },
  {
    q: "Can I leave a tribute without giving my real name?",
    a: "Yes. Many cemeteries allow first-name-only or anonymous tributes. The submission form will tell you what's required for that specific cemetery. Some require a real name to discourage spam — that's set by the cemetery, not by us.",
  },
  {
    q: "How do I become a co-owner of a memorial page?",
    a: "The cemetery (or an existing family co-owner) invites you by email. You'll receive a link to accept the invite and create an account if you don't have one. Co-owners can edit photos, biography, tributes, and events.",
  },
  {
    q: "Are tributes permanent?",
    a: "Once approved, tributes stay on the memorial page until removed by you, by a family co-owner, or by the cemetery's moderator. You can delete your own tributes at any time from Account → My tributes.",
  },
  {
    q: "Is my payment information secure?",
    a: "All payments are processed by Stripe — we never store your card number. The page uses TLS, and Stripe is PCI DSS Level 1 certified, the highest level of payment security.",
  },
  {
    q: "Can I order flowers for a grave at a different cemetery?",
    a: "Only if that cemetery is on MemorialSpace and has the Marketplace enabled. The product list on each memorial page reflects that specific cemetery's offerings.",
  },
  {
    q: "How do I cancel a recurring grave-care plan?",
    a: "Account → Orders → Recurring → Manage. You can pause or cancel any plan in one click. Cancellation takes effect at the end of the current paid period.",
  },
  {
    q: "I'm not technical — is the platform hard to use?",
    a: "It's designed to be friendly to people of any age. Grave Search is one box and one button. Reading a memorial is just like reading a Facebook post. If you ever get stuck, the “Help” button at the bottom-right of every page connects you to the cemetery's support team.",
  },
  {
    q: "What happens to a memorial page over time?",
    a: "It's permanent. Memorial pages are maintained by the cemetery for the life of the cemetery, even if family co-owners change or accounts close. Your loved one's story stays.",
  },
];

export default function TutorialFamilyPage() {
  return (
    <div className="overflow-hidden">
      <section className="relative pt-20 pb-12 px-4">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[500px] w-[1000px] rounded-full bg-pink-500/10 blur-3xl" />
        </div>
        <div className="container mx-auto max-w-4xl text-center">
          <Badge variant="outline" className="mb-6 border-pink-500/30 bg-pink-500/5 text-pink-400 px-4 py-1">
            <Heart className="h-3 w-3 mr-2" />
            For families & visitors
          </Badge>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-5">
            Family tutorial
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Find a loved one, leave a tribute, care for a memorial page, and stay close to those you love — wherever life takes you.
          </p>
          <div className="mt-7 flex flex-wrap gap-3 justify-center">
            <Button asChild className="bg-pink-500 hover:bg-pink-600 text-white"><Link href="/find">Find a loved one<ArrowRight className="h-4 w-4 ml-2" /></Link></Button>
            <Button asChild variant="outline"><Link href="/sign-in/family">Family sign-in</Link></Button>
          </div>
        </div>
      </section>

      <section className="py-8 px-4">
        <div className="container mx-auto max-w-5xl">
          <Card className="border-border/60 bg-card/40">
            <CardContent className="p-5 grid sm:grid-cols-3 gap-4 text-sm">
              <div className="flex items-start gap-3"><Search className="h-5 w-5 text-pink-400 shrink-0 mt-0.5" /><div><p className="font-semibold">No account needed</p><p className="text-muted-foreground">Search graves and read tributes as a guest.</p></div></div>
              <div className="flex items-start gap-3"><BookOpen className="h-5 w-5 text-pink-400 shrink-0 mt-0.5" /><div><p className="font-semibold">10 steps, ~20 minutes</p><p className="text-muted-foreground">Skim or follow along — every step has a screenshot.</p></div></div>
              <div className="flex items-start gap-3"><ShieldCheck className="h-5 w-5 text-pink-400 shrink-0 mt-0.5" /><div><p className="font-semibold">Private by default</p><p className="text-muted-foreground">You decide what's public, link-only, or family-only.</p></div></div>
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
                      <div className="h-10 w-10 rounded-lg bg-pink-500/10 flex items-center justify-center">
                        <s.icon className="h-5 w-5 text-pink-400" />
                      </div>
                      <div className="text-xs font-semibold uppercase tracking-widest text-pink-400">Step {String(s.num).padStart(2, "0")}</div>
                    </div>
                    <h2 className="text-2xl font-bold mb-3 leading-tight">{s.title}</h2>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-4">{s.body}</p>
                    <ul className="space-y-2">
                      {s.bullets.map((b) => (
                        <li key={b} className="text-sm flex gap-2 text-foreground/80">
                          <span className="mt-1.5 h-1 w-1 rounded-full bg-pink-400 shrink-0" />
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
                              <span className="font-semibold text-right">{r.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center text-muted-foreground text-sm">
                        <s.icon className="h-12 w-12 mx-auto mb-3 opacity-30" />
                        Try this step on your loved one's memorial page.
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
            <Badge variant="outline" className="mb-4 border-pink-500/30 bg-pink-500/5 text-pink-400">FAQ</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Family questions, answered</h2>
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
          <Card className="relative overflow-hidden border-pink-500/30 bg-gradient-to-br from-pink-500/10 via-card to-pink-300/5">
            <CardContent className="relative p-12 text-center">
              <h2 className="text-3xl font-bold mb-3">Stay close to those you love</h2>
              <p className="text-muted-foreground mb-7 max-w-xl mx-auto">Find a grave, light a candle, leave a memory — wherever life takes you.</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button asChild size="lg" className="bg-pink-500 hover:bg-pink-600 text-white px-8"><Link href="/find">Find a loved one<ArrowRight className="h-4 w-4 ml-2" /></Link></Button>
                <Button asChild size="lg" variant="outline" className="px-8"><Link href="/sign-in/family">Create a family account</Link></Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
