import { useState, type FormEvent, type ReactNode } from "react";
import { Eye, EyeOff, Loader2, Sparkles, KeyRound, Copy, Check, Wand2, AlertCircle } from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth, type SessionKind } from "@/lib/auth";

export type SignInTheme = "green" | "gold" | "rose";

const themeMap: Record<SignInTheme, { ring: string; text: string; gradient: string; button: string; logoBg: string }> = {
  green: {
    ring: "focus-visible:ring-primary/40",
    text: "text-primary",
    gradient: "from-primary/30 via-transparent to-transparent",
    button: "bg-primary hover:bg-primary/90 text-primary-foreground",
    logoBg: "bg-gradient-to-br from-primary to-[#2d5f3f]",
  },
  gold: {
    ring: "focus-visible:ring-[#d4a843]/40",
    text: "text-[#d4a843]",
    gradient: "from-[#d4a843]/25 via-transparent to-transparent",
    button: "bg-[#d4a843] hover:bg-[#c39637] text-background",
    logoBg: "bg-gradient-to-br from-[#d4a843] to-[#a17e25]",
  },
  rose: {
    ring: "focus-visible:ring-rose-400/40",
    text: "text-rose-400",
    gradient: "from-rose-500/25 via-transparent to-transparent",
    button: "bg-rose-500 hover:bg-rose-600 text-white",
    logoBg: "bg-gradient-to-br from-rose-500 to-rose-700",
  },
};

export interface SignInFormProps {
  portalLabel: string;
  title: string;
  subtitle: string;
  theme: SignInTheme;
  /** Which sign-in tier these credentials must satisfy on the server. */
  kind: SessionKind;
  demoEmail: string;
  demoPassword: string;
  /** Fallback path used if the server doesn't return one. */
  redirectTo: string;
  signUpHref?: string;
  signUpLabel?: string;
  rightPanel?: ReactNode;
}

export function SignInForm(props: SignInFormProps) {
  const { portalLabel, title, subtitle, theme, kind, demoEmail, demoPassword, redirectTo, signUpHref, signUpLabel, rightPanel } = props;
  const t = themeMap[theme];
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(true);
  const [copied, setCopied] = useState<"email" | "password" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (emailValue: string, passwordValue: string) => {
    setError(null);
    setLoading(true);
    try {
      const target = await signIn(kind, emailValue, passwordValue);
      window.location.href = target || redirectTo;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed");
      setLoading(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void submit(email, password);
  };

  const fillDemo = () => {
    setEmail(demoEmail);
    setPassword(demoPassword);
  };

  const fillDemoAndSubmit = () => {
    setEmail(demoEmail);
    setPassword(demoPassword);
    void submit(demoEmail, demoPassword);
  };

  const copyToClipboard = async (value: string, kind: "email" | "password") => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      setTimeout(() => setCopied((c) => (c === kind ? null : c)), 1500);
    } catch {
      // Clipboard not available — silently ignore.
    }
  };

  return (
    <div className="min-h-screen w-full bg-background flex flex-col">
      {/* Top bar */}
      <header className="w-full border-b border-border/40 bg-background/60 backdrop-blur">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 h-14 flex items-center justify-between">
          <a href="/" className="flex items-center">
            <Logo height={32} />
          </a>
          <a href="/" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            ← Back to home
          </a>
        </div>
      </header>

      <div className="flex-1 grid lg:grid-cols-2">
        {/* Left: form */}
        <div className="relative flex items-center justify-center p-6 sm:p-12">
          <div className={`pointer-events-none absolute inset-0 bg-gradient-to-tr ${t.gradient} opacity-50`} />
          <Card className="relative w-full max-w-md border-border/60 shadow-2xl shadow-black/30">
            <CardContent className="p-8 space-y-6">
              <div>
                <div className={`inline-flex items-center gap-2 rounded-full border ${t.text} border-current/20 bg-current/5 px-3 py-1 text-[11px] uppercase tracking-widest font-semibold`}>
                  <Sparkles className="h-3 w-3" />
                  {portalLabel}
                </div>
                <h1 className="mt-4 text-2xl font-bold tracking-tight">{title}</h1>
                <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
              </div>

              {/* Demo credentials — visible so reviewers can sign in instantly */}
              <div
                className={`rounded-lg border border-current/20 bg-current/5 ${t.text} p-3`}
                data-testid="demo-credentials"
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-bold min-w-0">
                    <KeyRound className="h-3 w-3 shrink-0" />
                    <span className="truncate">Demo · {portalLabel}</span>
                  </div>
                  <button
                    type="button"
                    onClick={fillDemoAndSubmit}
                    className={`inline-flex items-center gap-1 rounded ${t.button} px-2.5 py-1 text-[10px] font-semibold shadow-sm whitespace-nowrap shrink-0 transition-opacity hover:opacity-90`}
                    data-testid="button-instant-demo"
                  >
                    <Wand2 className="h-3 w-3" />
                    Instant sign-in
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-1.5 text-foreground/90">
                  <CredRow
                    label="Email"
                    value={demoEmail}
                    copied={copied === "email"}
                    onCopy={() => copyToClipboard(demoEmail, "email")}
                    testId="demo-email"
                  />
                  <CredRow
                    label="Password"
                    value={demoPassword}
                    copied={copied === "password"}
                    onCopy={() => copyToClipboard(demoPassword, "password")}
                    testId="demo-password"
                    mono
                  />
                </div>
                <button
                  type="button"
                  onClick={fillDemo}
                  className="mt-2 text-[10px] text-foreground/60 hover:text-foreground underline-offset-2 hover:underline"
                  data-testid="button-fill-only"
                >
                  Just fill the form (don't sign in)
                </button>
              </div>

              {error && (
                <div className="rounded-md border border-rose-500/40 bg-rose-500/10 text-rose-300 px-3 py-2 text-xs flex items-center gap-2" data-testid="sign-in-error">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4" data-testid="sign-in-form">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs uppercase tracking-wider text-muted-foreground">Work email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    autoComplete="email"
                    className={`h-11 ${t.ring}`}
                    data-testid="input-email"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-xs uppercase tracking-wider text-muted-foreground">Password</Label>
                    <button type="button" className={`text-xs ${t.text} hover:underline`}>Forgot?</button>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      autoComplete="current-password"
                      className={`h-11 pr-10 ${t.ring}`}
                      data-testid="input-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1.5 rounded"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                    <Checkbox checked={remember} onCheckedChange={(v) => setRemember(!!v)} />
                    Keep me signed in
                  </label>
                </div>

                <Button type="submit" disabled={loading} className={`w-full h-11 ${t.button}`} data-testid="button-submit">
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Signing in…
                    </>
                  ) : (
                    "Sign in"
                  )}
                </Button>
              </form>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border/60" />
                </div>
                <div className="relative flex justify-center text-[10px] uppercase tracking-widest">
                  <span className="bg-card px-3 text-muted-foreground">Or continue with</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant="outline" className="h-10" data-testid="button-google">
                  <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24"><path fill="#4285f4" d="M21.35 11.1H12v3.2h5.35c-.23 1.4-1.6 4.1-5.35 4.1-3.2 0-5.83-2.65-5.83-5.9s2.63-5.9 5.83-5.9c1.83 0 3.05.78 3.75 1.45l2.55-2.45C16.7 4.1 14.6 3.1 12 3.1 6.95 3.1 2.85 7.2 2.85 12.5S6.95 21.9 12 21.9c6.93 0 9.6-4.85 9.6-9.35 0-.62-.07-1.1-.25-1.45z"/></svg>
                  Google
                </Button>
                <Button type="button" variant="outline" className="h-10" data-testid="button-microsoft">
                  <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24"><path fill="#f35325" d="M2 2h10v10H2z"/><path fill="#81bc06" d="M12 2h10v10H12z"/><path fill="#05a6f0" d="M2 12h10v10H2z"/><path fill="#ffba08" d="M12 12h10v10H12z"/></svg>
                  Microsoft
                </Button>
              </div>

              <p className="text-center text-xs text-muted-foreground">
                {signUpLabel ? (
                  <>
                    {signUpLabel}{" "}
                    <a href={signUpHref ?? "/"} className={`${t.text} hover:underline font-medium`}>
                      Get started
                    </a>
                  </>
                ) : (
                  <>
                    New to MemorialSpace?{" "}
                    <a href="/" className={`${t.text} hover:underline font-medium`}>Talk to sales</a>
                  </>
                )}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Right: marketing/visual panel */}
        <div className="hidden lg:flex relative bg-card/30 border-l border-border/40 items-center justify-center p-12 overflow-hidden">
          <div className={`pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full bg-gradient-radial ${t.gradient} blur-3xl opacity-60`} />
          <div className="relative max-w-md">{rightPanel}</div>
        </div>
      </div>

      <footer className="border-t border-border/40 py-4">
        <div className="container mx-auto max-w-7xl px-6 flex flex-col md:flex-row items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">© 2026 MemorialSpace. Honoring legacies with technology.</p>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <a href="/privacy-policy" className="hover:text-foreground">Privacy</a>
            <a href="/terms-and-conditions" className="hover:text-foreground">Terms</a>
            <a href="/" className="hover:text-foreground">Security</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function CredRow({ label, value, copied, onCopy, testId, mono }: {
  label: string; value: string; copied: boolean; onCopy: () => void; testId: string; mono?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md bg-background/70 border border-border/60 px-2 py-1.5">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground w-16 shrink-0">{label}</span>
      <code
        className={`flex-1 min-w-0 truncate text-xs ${mono ? "font-mono" : ""} text-foreground select-all`}
        data-testid={testId}
      >
        {value}
      </code>
      <button
        type="button"
        onClick={onCopy}
        className="shrink-0 inline-flex items-center justify-center h-6 w-6 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        aria-label={`Copy ${label.toLowerCase()}`}
        data-testid={`${testId}-copy`}
      >
        {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
      </button>
    </div>
  );
}
