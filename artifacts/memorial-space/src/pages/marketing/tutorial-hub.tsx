import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Heart, ArrowRight, BookOpen, PlayCircle, Headphones } from "lucide-react";

export default function TutorialHubPage() {
  return (
    <div className="overflow-hidden">
      <section className="relative pt-20 pb-16 px-4">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[500px] w-[1000px] rounded-full bg-primary/10 blur-3xl" />
        </div>
        <div className="container mx-auto max-w-4xl text-center">
          <Badge variant="outline" className="mb-6 border-primary/30 bg-primary/5 text-primary px-4 py-1">
            <BookOpen className="h-3 w-3 mr-2" />
            Tutorials
          </Badge>
          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight mb-6">
            Get going in <span className="bg-gradient-to-r from-primary via-emerald-400 to-[#d4a843] bg-clip-text text-transparent">under an hour</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Step-by-step guides for cemetery operators and for the families they serve. Every screen is mapped, every action is named, every common question is answered.
          </p>
        </div>
      </section>

      <section className="pb-12 px-4">
        <div className="container mx-auto max-w-5xl grid md:grid-cols-2 gap-5">
          <Card className="border-border/60 bg-card hover:border-primary/40 transition-all">
            <CardContent className="p-8">
              <div className="h-12 w-12 rounded-lg bg-primary/15 flex items-center justify-center mb-5">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <p className="text-xs uppercase tracking-widest text-primary font-semibold mb-2">For cemetery owners & staff</p>
              <h2 className="text-2xl font-bold mb-3">Operator tutorial</h2>
              <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                Onboard your cemetery: import plots, take your first booking, log a burial, run a work order, send an invoice, and publish memorial pages — with screenshots of every step.
              </p>
              <Button asChild className="bg-primary hover:bg-primary/90">
                <Link href="/tutorial/cemetery">Open operator guide<ArrowRight className="h-4 w-4 ml-2" /></Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card hover:border-pink-500/40 transition-all">
            <CardContent className="p-8">
              <div className="h-12 w-12 rounded-lg bg-pink-500/15 flex items-center justify-center mb-5">
                <Heart className="h-6 w-6 text-pink-400" />
              </div>
              <p className="text-xs uppercase tracking-widest text-pink-400 font-semibold mb-2">For families & visitors</p>
              <h2 className="text-2xl font-bold mb-3">Family tutorial</h2>
              <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                Find a loved one's grave, scan a QR memorial, leave a tribute, manage a memorial page you co-own, and order flowers or care services — all explained with screenshots.
              </p>
              <Button asChild className="bg-pink-500 hover:bg-pink-600 text-white">
                <Link href="/tutorial/family">Open family guide<ArrowRight className="h-4 w-4 ml-2" /></Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="py-16 px-4 bg-card/30 border-y border-border/40">
        <div className="container mx-auto max-w-5xl">
          <h2 className="text-2xl font-bold mb-8 text-center">More ways to learn</h2>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              { icon: PlayCircle, title: "Live demo", desc: "Book a 30-minute screen-share with a product specialist on your real data.", href: "/contact", cta: "Book a demo" },
              { icon: BookOpen, title: "Feature reference", desc: "Browse every module in the platform with screenshots, capabilities, and limits.", href: "/features", cta: "See features" },
              { icon: Headphones, title: "Talk to support", desc: "Existing customer? Email support@memorialspace.example or use the in-app chat.", href: "/contact", cta: "Contact us" },
            ].map((c) => (
              <Card key={c.title} className="border-border/60 bg-card">
                <CardContent className="p-6">
                  <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center mb-4">
                    <c.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-1">{c.title}</h3>
                  <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{c.desc}</p>
                  <Button asChild variant="outline" size="sm"><Link href={c.href}>{c.cta}</Link></Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
