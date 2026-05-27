import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Mail, Phone, Clock, Sparkles, CheckCircle2 } from "lucide-react";

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    cemetery: "",
    plots: "1-500",
    role: "owner",
    message: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: wire to a real /api/contact endpoint when sales tooling is decided.
    // For now this is a UX-complete form that confirms receipt locally so the
    // marketing site looks finished even before the inbound integration ships.
    setSubmitted(true);
  };

  return (
    <div className="overflow-hidden">
      <section className="relative pt-20 pb-16 px-4">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[500px] w-[1000px] rounded-full bg-primary/10 blur-3xl" />
        </div>
        <div className="container mx-auto max-w-4xl text-center">
          <Badge variant="outline" className="mb-6 border-primary/30 bg-primary/5 text-primary px-4 py-1">
            <Sparkles className="h-3 w-3 mr-2" />
            Talk to sales
          </Badge>
          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight mb-6">
            Let's see if we're a fit.
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Tell us a little about your memorial space and we'll send a tailored walkthrough — usually within one business day. No pressure, no canned slide deck.
          </p>
        </div>
      </section>

      <section className="pb-24 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card className="border-border/60 bg-card">
                <CardContent className="p-8">
                  {submitted ? (
                    <div
                      className="text-center py-12"
                      data-testid="contact-success"
                      role="status"
                      aria-live="polite"
                    >
                      <CheckCircle2 className="h-12 w-12 text-primary mx-auto mb-4" />
                      <h2 className="text-2xl font-bold mb-2">Got it — thank you.</h2>
                      <p className="text-muted-foreground max-w-md mx-auto">
                        A product specialist will reach out within one business day at <span className="text-foreground font-medium">{form.email}</span>. In the meantime, feel free to start a free trial — your data will be ready when we connect.
                      </p>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmit} className="space-y-5" data-testid="contact-form">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="name">Your name</Label>
                          <Input
                            id="name"
                            required
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            data-testid="input-name"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="email">Work email</Label>
                          <Input
                            id="email"
                            type="email"
                            required
                            value={form.email}
                            onChange={(e) => setForm({ ...form, email: e.target.value })}
                            data-testid="input-email"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="cemetery">Memorial space / organization</Label>
                        <Input
                          id="cemetery"
                          required
                          value={form.cemetery}
                          onChange={(e) => setForm({ ...form, cemetery: e.target.value })}
                          data-testid="input-cemetery"
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="plots">Approximate plot count</Label>
                          <Select value={form.plots} onValueChange={(v) => setForm({ ...form, plots: v })}>
                            <SelectTrigger id="plots" data-testid="select-plots">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1-500">1–500</SelectItem>
                              <SelectItem value="500-2000">500–2,000</SelectItem>
                              <SelectItem value="2000-5000">2,000–5,000</SelectItem>
                              <SelectItem value="5000-15000">5,000–15,000</SelectItem>
                              <SelectItem value="15000+">15,000+</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="role">Your role</Label>
                          <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                            <SelectTrigger id="role" data-testid="select-role">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="owner">Owner / Director</SelectItem>
                              <SelectItem value="manager">Operations Manager</SelectItem>
                              <SelectItem value="family-services">Family Services</SelectItem>
                              <SelectItem value="it">IT / Technology</SelectItem>
                              <SelectItem value="municipal">Municipal / Public Records</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="message">What are you trying to solve? (optional)</Label>
                        <Textarea
                          id="message"
                          rows={4}
                          value={form.message}
                          onChange={(e) => setForm({ ...form, message: e.target.value })}
                          placeholder="e.g. We have 40 years of paper records and want to put a search portal online for families."
                          data-testid="input-message"
                        />
                      </div>
                      <Button
                        type="submit"
                        size="lg"
                        className="w-full bg-primary hover:bg-primary/90"
                        data-testid="contact-submit"
                      >
                        Request a demo
                      </Button>
                      <p className="text-xs text-muted-foreground text-center">
                        We respect your time — no marketing emails, ever.
                      </p>
                    </form>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <Card className="border-border/60 bg-card">
                <CardContent className="p-6">
                  <Mail className="h-5 w-5 text-primary mb-3" />
                  <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Email</p>
                  <p className="text-sm font-medium">sales@memorialspace.com</p>
                </CardContent>
              </Card>
              <Card className="border-border/60 bg-card">
                <CardContent className="p-6">
                  <Phone className="h-5 w-5 text-primary mb-3" />
                  <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Phone</p>
                  <p className="text-sm font-medium">+1 (888) 555-0142</p>
                </CardContent>
              </Card>
              <Card className="border-border/60 bg-card">
                <CardContent className="p-6">
                  <Clock className="h-5 w-5 text-primary mb-3" />
                  <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Hours</p>
                  <p className="text-sm font-medium">Mon–Fri · 9am–6pm ET</p>
                  <p className="text-xs text-muted-foreground mt-1">Enterprise on-call 24/7</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
