import { useState, type FormEvent } from "react";
import { Loader2, Store, AlertCircle } from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useVendorSignup } from "./api";

/**
 * Public vendor signup page. Creates the account, signs the user in
 * automatically (server returns a session cookie), and lands them on
 * `/vendor` to finish their profile and flip the publish toggle when ready.
 */
export default function VendorSignup() {
  const signup = useVendorSignup();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [description, setDescription] = useState("");
  const [categoriesText, setCategoriesText] = useState("");
  const [areasText, setAreasText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const splitTrim = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
    try {
      await signup.mutateAsync({
        email: email.trim(),
        password,
        businessName: businessName.trim(),
        contactName: contactName.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
        description: description.trim() || undefined,
        categories: splitTrim(categoriesText),
        serviceAreas: splitTrim(areasText),
      });
      window.location.href = "/vendor";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
    }
  };

  return (
    <div className="min-h-screen w-full bg-background flex flex-col">
      <header className="w-full border-b border-border/40 bg-background/60 backdrop-blur">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 h-14 flex items-center justify-between">
          <a href="/" className="flex items-center">
            <Logo height={32} />
          </a>
          <a href="/sign-in/vendor" className="text-xs text-muted-foreground hover:text-foreground">
            Already have an account? Sign in →
          </a>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
        <Card className="w-full max-w-2xl border-border/60 shadow-2xl shadow-black/30">
          <CardContent className="p-8 space-y-6">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#d4a843]/30 bg-[#d4a843]/5 px-3 py-1 text-[11px] uppercase tracking-widest font-semibold text-[#d4a843]">
                <Store className="h-3 w-3" /> Vendor portal
              </div>
              <h1 className="mt-4 text-2xl font-bold tracking-tight">Create your vendor account</h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Florists, monument carvers, transport, catering — start receiving requests from families today.
              </p>
            </div>

            {error && (
              <div className="rounded-md border border-rose-500/40 bg-rose-500/10 text-rose-300 px-3 py-2 text-xs flex items-center gap-2" data-testid="signup-error">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={submit} className="space-y-4" data-testid="vendor-signup-form">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="businessName">Business name *</Label>
                  <Input
                    id="businessName"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="Eternal Blooms Florist"
                    required
                    data-testid="input-business-name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="contactName">Your name</Label>
                  <Input id="contactName" value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Jane Doe" data-testid="input-contact-name" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email *</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="hello@example.com" required autoComplete="email" data-testid="input-email" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Password * (min. 8 chars)</Label>
                  <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={8} autoComplete="new-password" data-testid="input-password" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="contactPhone">Contact phone</Label>
                  <Input id="contactPhone" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="(555) 123-4567" data-testid="input-contact-phone" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="categories">Service categories</Label>
                  <Input id="categories" value={categoriesText} onChange={(e) => setCategoriesText(e.target.value)} placeholder="florist, catering" data-testid="input-categories" />
                  <p className="text-[10px] text-muted-foreground">Comma-separated.</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="areas">Service areas</Label>
                <Input id="areas" value={areasText} onChange={(e) => setAreasText(e.target.value)} placeholder="Seattle, Bellevue, Tacoma" data-testid="input-areas" />
                <p className="text-[10px] text-muted-foreground">Cities or regions you serve. Comma-separated.</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="description">About your business</Label>
                <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="A short description shown to families browsing the directory." rows={4} data-testid="input-description" />
              </div>

              <Button type="submit" disabled={signup.isPending} className="w-full h-11 bg-[#d4a843] hover:bg-[#c39637] text-background" data-testid="button-submit">
                {signup.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating account…</>
                ) : (
                  "Create vendor account"
                )}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Your account starts hidden — you'll publish it from the dashboard once your profile is ready.
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
