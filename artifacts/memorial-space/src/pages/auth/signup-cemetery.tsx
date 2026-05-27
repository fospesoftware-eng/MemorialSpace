import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Loader2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  CEMETERY_TYPE_META,
  FEATURE_GROUPS,
  FEATURE_META,
  defaultFeaturesFor,
  type CemeteryType,
  type PlatformFeature,
} from "@/lib/cemetery-features";

type Step = 1 | 2 | 3 | 4;

const STEPS: { n: Step; label: string }[] = [
  { n: 1, label: "Cemetery types" },
  { n: 2, label: "Cemetery details" },
  { n: 3, label: "Owner account" },
  { n: 4, label: "Features" },
];

export default function SignupCemetery() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState<Step>(1);
  const [submitting, setSubmitting] = useState(false);

  const [types, setTypes] = useState<CemeteryType[]>([]);
  const [orgName, setOrgName] = useState("");
  const [orgCity, setOrgCity] = useState("");
  const [orgCountry, setOrgCountry] = useState("");
  const [orgAddress, setOrgAddress] = useState("");
  const [orgPhone, setOrgPhone] = useState("");
  const [orgWebsite, setOrgWebsite] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [ownerJob, setOwnerJob] = useState("");
  const [features, setFeatures] = useState<Partial<Record<PlatformFeature, boolean>>>({});
  const [touchedFeatures, setTouchedFeatures] = useState(false);

  // When the user moves into step 4 the first time, auto-populate from defaults.
  const recommendedFeatures = useMemo(() => defaultFeaturesFor(types), [types]);
  const effectiveFeatures = touchedFeatures ? features : recommendedFeatures;

  function toggleType(t: CemeteryType) {
    setTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  function toggleFeature(f: PlatformFeature) {
    if (!touchedFeatures) {
      setFeatures(recommendedFeatures);
      setTouchedFeatures(true);
    }
    setFeatures((prev) => ({ ...prev, [f]: !((touchedFeatures ? prev : recommendedFeatures)[f] ?? false) }));
  }

  const canAdvance =
    (step === 1 && types.length > 0) ||
    (step === 2 && orgName.trim().length >= 2) ||
    (step === 3 &&
      ownerName.trim().length >= 2 &&
      /.+@.+\..+/.test(ownerEmail) &&
      ownerPassword.length >= 8) ||
    step === 4;

  async function submit() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/public/cemetery-signup", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          cemeteryTypes: types,
          organization: {
            name: orgName.trim(),
            city: orgCity.trim() || null,
            country: orgCountry.trim() || null,
            address: orgAddress.trim() || null,
            phone: orgPhone.trim() || null,
            website: orgWebsite.trim() || null,
          },
          owner: {
            name: ownerName.trim(),
            email: ownerEmail.trim().toLowerCase(),
            password: ownerPassword,
            jobTitle: ownerJob.trim() || null,
          },
          features: effectiveFeatures,
        }),
      });
      const text = await res.text();
      const body = text ? JSON.parse(text) : {};
      if (!res.ok) {
        throw new Error(body?.error || `Signup failed (${res.status})`);
      }
      toast({
        title: "Welcome to MemorialSpace",
        description: "Your cemetery workspace is ready.",
      });
      setLocation(body?.redirectTo ?? "/app");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Something went wrong";
      toast({ title: "Couldn't create account", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-foreground">
      <div className="max-w-5xl mx-auto px-4 py-8 md:py-14">
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" /> Back to home
          </Link>
          <Link href="/sign-in/cemetery" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Already have an account? <span className="text-[#d4a843]">Sign in</span>
          </Link>
        </div>

        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#d4a843]/30 bg-[#d4a843]/5 px-3 py-1 text-xs font-semibold text-[#d4a843] mb-4">
            <Sparkles className="h-3.5 w-3.5" /> 14-day free trial · no card required
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            Set up your MemorialSpace workspace
          </h1>
          <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
            Pick the kind of grounds you operate, tell us a bit about your cemetery,
            and create your owner account. You'll be running in minutes.
          </p>
        </div>

        <Stepper step={step} />

        <div className="mt-8 rounded-xl border border-border/60 bg-card/60 backdrop-blur p-6 md:p-8 shadow-xl">
          {step === 1 && (
            <StepTypes types={types} onToggle={toggleType} />
          )}
          {step === 2 && (
            <StepOrgDetails
              orgName={orgName}
              setOrgName={setOrgName}
              orgCity={orgCity}
              setOrgCity={setOrgCity}
              orgCountry={orgCountry}
              setOrgCountry={setOrgCountry}
              orgAddress={orgAddress}
              setOrgAddress={setOrgAddress}
              orgPhone={orgPhone}
              setOrgPhone={setOrgPhone}
              orgWebsite={orgWebsite}
              setOrgWebsite={setOrgWebsite}
              types={types}
            />
          )}
          {step === 3 && (
            <StepOwner
              ownerName={ownerName}
              setOwnerName={setOwnerName}
              ownerEmail={ownerEmail}
              setOwnerEmail={setOwnerEmail}
              ownerPassword={ownerPassword}
              setOwnerPassword={setOwnerPassword}
              ownerJob={ownerJob}
              setOwnerJob={setOwnerJob}
            />
          )}
          {step === 4 && (
            <StepFeatures
              types={types}
              effective={effectiveFeatures}
              onToggle={toggleFeature}
            />
          )}

          <div className="flex items-center justify-between mt-8 pt-6 border-t border-border/40">
            <Button
              variant="ghost"
              disabled={step === 1 || submitting}
              onClick={() => setStep((s) => (s > 1 ? ((s - 1) as Step) : s))}
              data-testid="signup-back"
            >
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
            {step < 4 ? (
              <Button
                disabled={!canAdvance || submitting}
                onClick={() => setStep((s) => ((s + 1) as Step))}
                data-testid="signup-next"
              >
                Continue <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button
                disabled={submitting || types.length === 0}
                onClick={submit}
                data-testid="signup-submit"
                className="bg-[#d4a843] hover:bg-[#c4983a] text-slate-900"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating workspace…
                  </>
                ) : (
                  <>
                    Create my workspace <CheckCircle2 className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stepper({ step }: { step: Step }) {
  return (
    <ol className="flex items-center justify-center gap-2 md:gap-4 text-xs md:text-sm">
      {STEPS.map((s, i) => {
        const isCurrent = s.n === step;
        const isDone = s.n < step;
        return (
          <li key={s.n} className="flex items-center gap-2 md:gap-3">
            <span
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold transition-colors",
                isDone && "bg-emerald-500/20 border-emerald-500/40 text-emerald-300",
                isCurrent && "bg-[#d4a843]/20 border-[#d4a843]/50 text-[#d4a843]",
                !isCurrent && !isDone && "bg-muted/40 border-border/40 text-muted-foreground",
              )}
            >
              {isDone ? <Check className="h-4 w-4" /> : s.n}
            </span>
            <span
              className={cn(
                "hidden md:inline",
                isCurrent ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {s.label}
            </span>
            {i < STEPS.length - 1 && <span className="w-6 md:w-12 h-px bg-border/50" />}
          </li>
        );
      })}
    </ol>
  );
}

function StepTypes({
  types,
  onToggle,
}: {
  types: CemeteryType[];
  onToggle: (t: CemeteryType) => void;
}) {
  return (
    <div>
      <h2 className="text-2xl font-semibold tracking-tight">Choose your cemetery type</h2>
      <p className="text-sm text-muted-foreground mt-1">
        Pick every kind of grounds you operate. We'll switch on the right modules
        for you. Most operators choose one — some choose two or three.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
        {CEMETERY_TYPE_META.map((t) => {
          const Icon = t.icon;
          const selected = types.includes(t.value);
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => onToggle(t.value)}
              data-testid={`signup-type-${t.value}`}
              aria-pressed={selected}
              className={cn(
                "relative text-left p-5 rounded-xl border-2 transition-all group",
                "hover:border-[#d4a843]/60 hover:bg-[#d4a843]/5",
                selected
                  ? "border-[#d4a843] bg-[#d4a843]/10 shadow-lg shadow-[#d4a843]/10"
                  : "border-border/60 bg-muted/20",
              )}
            >
              {selected && (
                <span className="absolute top-3 right-3 h-6 w-6 rounded-full bg-[#d4a843] text-slate-900 flex items-center justify-center">
                  <Check className="h-4 w-4" strokeWidth={3} />
                </span>
              )}
              <div
                className={cn(
                  "h-14 w-14 rounded-xl flex items-center justify-center mb-4 transition-colors",
                  selected ? "bg-[#d4a843]/20" : "bg-card border border-border/60",
                )}
              >
                <Icon className={cn("h-8 w-8", selected ? "text-[#d4a843]" : t.accent)} />
              </div>
              <h3 className="font-semibold text-base">{t.label}</h3>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{t.blurb}</p>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground mt-6">
        {types.length === 0
          ? "Select at least one to continue."
          : `${types.length} selected — you can change this later.`}
      </p>
    </div>
  );
}

function StepOrgDetails(props: {
  orgName: string;
  setOrgName: (v: string) => void;
  orgCity: string;
  setOrgCity: (v: string) => void;
  orgCountry: string;
  setOrgCountry: (v: string) => void;
  orgAddress: string;
  setOrgAddress: (v: string) => void;
  orgPhone: string;
  setOrgPhone: (v: string) => void;
  orgWebsite: string;
  setOrgWebsite: (v: string) => void;
  types: CemeteryType[];
}) {
  return (
    <div>
      <h2 className="text-2xl font-semibold tracking-tight">Tell us about your cemetery</h2>
      <p className="text-sm text-muted-foreground mt-1">
        Your name and location are shown on your public site and on memorial pages.
        You can edit any of this from settings later.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        <div className="md:col-span-2">
          <Label>Cemetery name *</Label>
          <Input
            data-testid="signup-org-name"
            value={props.orgName}
            onChange={(e) => props.setOrgName(e.target.value)}
            placeholder="e.g. Riverside Memorial Gardens"
            className="mt-1.5"
          />
        </div>
        <div>
          <Label>City</Label>
          <Input
            data-testid="signup-org-city"
            value={props.orgCity}
            onChange={(e) => props.setOrgCity(e.target.value)}
            placeholder="Springfield"
            className="mt-1.5"
          />
        </div>
        <div>
          <Label>Country</Label>
          <Input
            data-testid="signup-org-country"
            value={props.orgCountry}
            onChange={(e) => props.setOrgCountry(e.target.value)}
            placeholder="United States"
            className="mt-1.5"
          />
        </div>
        <div className="md:col-span-2">
          <Label>Street address</Label>
          <Input
            data-testid="signup-org-address"
            value={props.orgAddress}
            onChange={(e) => props.setOrgAddress(e.target.value)}
            placeholder="123 Memorial Drive"
            className="mt-1.5"
          />
        </div>
        <div>
          <Label>Phone</Label>
          <Input
            data-testid="signup-org-phone"
            value={props.orgPhone}
            onChange={(e) => props.setOrgPhone(e.target.value)}
            placeholder="+1 555 123 4567"
            className="mt-1.5"
          />
        </div>
        <div>
          <Label>Website</Label>
          <Input
            data-testid="signup-org-website"
            value={props.orgWebsite}
            onChange={(e) => props.setOrgWebsite(e.target.value)}
            placeholder="https://example.org"
            className="mt-1.5"
          />
        </div>
      </div>
      <div className="mt-5 p-3 rounded-lg bg-muted/40 border border-border/40 text-xs text-muted-foreground">
        Selected:&nbsp;
        {props.types
          .map((t) => CEMETERY_TYPE_META.find((m) => m.value === t)?.label)
          .filter(Boolean)
          .join(" · ")}
      </div>
    </div>
  );
}

function StepOwner(props: {
  ownerName: string;
  setOwnerName: (v: string) => void;
  ownerEmail: string;
  setOwnerEmail: (v: string) => void;
  ownerPassword: string;
  setOwnerPassword: (v: string) => void;
  ownerJob: string;
  setOwnerJob: (v: string) => void;
}) {
  return (
    <div>
      <h2 className="text-2xl font-semibold tracking-tight">Create your owner account</h2>
      <p className="text-sm text-muted-foreground mt-1">
        You'll be the first owner — invite your team once you're inside.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        <div>
          <Label>Your name *</Label>
          <Input
            data-testid="signup-owner-name"
            value={props.ownerName}
            onChange={(e) => props.setOwnerName(e.target.value)}
            placeholder="Jane Doe"
            className="mt-1.5"
          />
        </div>
        <div>
          <Label>Job title</Label>
          <Input
            data-testid="signup-owner-job"
            value={props.ownerJob}
            onChange={(e) => props.setOwnerJob(e.target.value)}
            placeholder="Owner / Director"
            className="mt-1.5"
          />
        </div>
        <div>
          <Label>Work email *</Label>
          <Input
            data-testid="signup-owner-email"
            type="email"
            value={props.ownerEmail}
            onChange={(e) => props.setOwnerEmail(e.target.value)}
            placeholder="you@cemetery.org"
            className="mt-1.5"
            autoComplete="email"
          />
        </div>
        <div>
          <Label>Password *</Label>
          <Input
            data-testid="signup-owner-password"
            type="password"
            value={props.ownerPassword}
            onChange={(e) => props.setOwnerPassword(e.target.value)}
            placeholder="At least 8 characters"
            className="mt-1.5"
            autoComplete="new-password"
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-4">
        By creating an account you agree to our terms of service. Your data is
        SOC 2 Type II hosted and exportable at any time.
      </p>
    </div>
  );
}

function StepFeatures({
  types,
  effective,
  onToggle,
}: {
  types: CemeteryType[];
  effective: Partial<Record<PlatformFeature, boolean>>;
  onToggle: (f: PlatformFeature) => void;
}) {
  return (
    <div>
      <h2 className="text-2xl font-semibold tracking-tight">Pick the modules you want</h2>
      <p className="text-sm text-muted-foreground mt-1">
        We've turned on what most {types.length === 1 ? "" : "multi-type "}operators use.
        Toggle anything you don't need — you can change this later in settings or your
        super-admin can adjust per plan.
      </p>
      <div className="space-y-6 mt-6">
        {FEATURE_GROUPS.map((group) => {
          const items = FEATURE_META.filter((f) => f.group === group);
          return (
            <div key={group}>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                {group}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {items.map((f) => {
                  const Icon = f.icon;
                  const on = !!effective[f.key];
                  return (
                    <label
                      key={f.key}
                      className={cn(
                        "flex items-start gap-3 p-3 rounded-lg border transition-colors cursor-pointer",
                        on
                          ? "border-[#d4a843]/40 bg-[#d4a843]/5"
                          : "border-border/40 bg-muted/20 hover:bg-muted/30",
                      )}
                    >
                      <div
                        className={cn(
                          "h-9 w-9 rounded-md flex items-center justify-center flex-shrink-0",
                          on
                            ? "bg-[#d4a843]/15 text-[#d4a843]"
                            : "bg-card text-muted-foreground border border-border/60",
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium text-sm">{f.label}</span>
                          <Switch
                            checked={on}
                            onCheckedChange={() => onToggle(f.key)}
                            data-testid={`signup-feature-${f.key}`}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                          {f.description}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
