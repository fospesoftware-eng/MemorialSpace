/**
 * Reusable Stripe payment-gateway settings card. Drives both:
 *   - Super Admin → platform-level Stripe (charges cemetery operators)
 *   - Cemetery Owner → per-org Stripe (charges their families/customers)
 *
 * The only difference between the two scopes is the API path the underlying
 * hooks talk to, so this component takes a `scope` prop and stays otherwise
 * identical between surfaces.
 */
import { useEffect, useMemo, useState } from "react";
import {
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Eye,
  EyeOff,
  ExternalLink,
  Webhook,
  Building2,
  Beaker,
  Zap,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

import {
  COMMON_CURRENCIES,
  VERIFY_STATUS_LABEL,
  VERIFY_STATUS_TONE,
  usePaymentSettings,
  useTestPaymentGateway,
  useUpdatePaymentSettings,
  type PaymentSettings,
  type PaymentSettingsPatch,
  type VerifyResult,
} from "@/lib/payment-gateway";

interface Props {
  scope: "platform" | "org";
  /** Lead-in copy that explains *why* this gateway is being configured. */
  intro: string;
}

interface FormState {
  enabled: boolean;
  mode: "test" | "live";
  publishableKey: string;
  secretKey: string;
  webhookSecret: string;
  defaultCurrency: string;
  statementDescriptor: string;
}

function settingsToForm(s: PaymentSettings): FormState {
  return {
    enabled: s.enabled,
    mode: s.mode,
    publishableKey: s.publishableKey ?? "",
    secretKey: s.secretKey ?? "",
    webhookSecret: s.webhookSecret ?? "",
    defaultCurrency: s.defaultCurrency,
    statementDescriptor: s.statementDescriptor ?? "",
  };
}

/**
 * Build the patch we send to the server: only fields the user actually
 * touched, and only secret values that aren't the masked placeholder.
 */
function diff(form: FormState, base: PaymentSettings): PaymentSettingsPatch {
  const patch: PaymentSettingsPatch = {};
  if (form.enabled !== base.enabled) patch.enabled = form.enabled;
  if (form.mode !== base.mode) patch.mode = form.mode;
  if (form.defaultCurrency !== base.defaultCurrency) {
    patch.defaultCurrency = form.defaultCurrency.toUpperCase();
  }
  const sd = form.statementDescriptor.trim() || null;
  if (sd !== (base.statementDescriptor ?? null)) patch.statementDescriptor = sd;

  // Secret fields: only send if (a) user cleared it (server stores null)
  // or (b) user typed a real value (not the masked placeholder).
  const considerSecret = (
    nextRaw: string,
    masked: string | null,
  ): string | null | undefined => {
    const next = nextRaw.trim();
    const baseMasked = masked ?? "";
    if (next === baseMasked) return undefined; // unchanged
    if (next.startsWith("••••")) return undefined; // still masked, skip
    return next === "" ? null : next;
  };

  const pk = considerSecret(form.publishableKey, base.publishableKey);
  if (pk !== undefined) patch.publishableKey = pk;
  const sk = considerSecret(form.secretKey, base.secretKey);
  if (sk !== undefined) patch.secretKey = sk;
  const ws = considerSecret(form.webhookSecret, base.webhookSecret);
  if (ws !== undefined) patch.webhookSecret = ws;
  return patch;
}

export function PaymentGatewayCard({ scope, intro }: Props) {
  const settingsQuery = usePaymentSettings(scope);
  const updateMut = useUpdatePaymentSettings(scope);
  const testMut = useTestPaymentGateway(scope);
  const { toast } = useToast();

  const [form, setForm] = useState<FormState | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [showWebhook, setShowWebhook] = useState(false);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);

  // Resync local form whenever the server payload changes (initial load,
  // after save, after test). Key on updatedAt so re-renders don't clobber
  // user edits in flight.
  const updatedKey = settingsQuery.data?.updatedAt ?? "";
  useEffect(() => {
    if (settingsQuery.data) setForm(settingsToForm(settingsQuery.data));
    setVerifyResult(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updatedKey]);

  const dirty = useMemo(() => {
    if (!form || !settingsQuery.data) return false;
    return Object.keys(diff(form, settingsQuery.data)).length > 0;
  }, [form, settingsQuery.data]);

  const status: PaymentSettings["lastVerifiedStatus"] =
    settingsQuery.data?.lastVerifiedStatus ?? "untested";

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  async function onSave() {
    if (!form || !settingsQuery.data) return;
    const patch = diff(form, settingsQuery.data);
    if (Object.keys(patch).length === 0) return;
    try {
      await updateMut.mutateAsync(patch);
      toast({
        title: "Payment settings saved",
        description: "Stripe configuration updated.",
      });
    } catch (e) {
      toast({
        title: "Save failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    }
  }

  async function onTest() {
    if (!settingsQuery.data?.hasSecretKey) {
      toast({
        title: "No secret key",
        description: "Save a Stripe secret key before testing the connection.",
        variant: "destructive",
      });
      return;
    }
    if (dirty) {
      toast({
        title: "Save first",
        description: "Save your changes before testing the connection.",
      });
      return;
    }
    try {
      const result = await testMut.mutateAsync();
      setVerifyResult(result.verification);
      if (result.verification.status === "ok") {
        toast({
          title: "Connection successful",
          description: result.verification.account?.name
            ? `Linked to ${result.verification.account.name}`
            : `Linked to Stripe account ${result.verification.account?.id}`,
        });
      } else {
        toast({
          title: "Connection failed",
          description:
            result.verification.message ??
            VERIFY_STATUS_LABEL[result.verification.status],
          variant: "destructive",
        });
      }
    } catch (e) {
      toast({
        title: "Test failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    }
  }

  // Error first: a 401/403 fetch never resolves to data, so we'd otherwise
  // get stuck on the loading skeleton forever.
  if (settingsQuery.isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-destructive flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> Couldn't load payment settings
          </CardTitle>
          <CardDescription>
            {(settingsQuery.error as Error | undefined)?.message ?? "Unknown error"}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (settingsQuery.isLoading || !form || !settingsQuery.data) {
    return (
      <Card data-testid={`payment-gateway-card-${scope}`}>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <CardTitle>Loading payment settings…</CardTitle>
          </div>
        </CardHeader>
      </Card>
    );
  }

  const data = settingsQuery.data;
  const isVerified = data.lastVerifiedStatus === "ok";

  return (
    <Card data-testid={`payment-gateway-card-${scope}`}>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Stripe Payment Gateway
            </CardTitle>
            <CardDescription className="mt-1 max-w-2xl">{intro}</CardDescription>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge
              variant="outline"
              className={VERIFY_STATUS_TONE[status]}
              data-testid={`payment-status-${scope}`}
            >
              {isVerified ? (
                <CheckCircle2 className="h-3 w-3 mr-1" />
              ) : (
                <AlertTriangle className="h-3 w-3 mr-1" />
              )}
              {VERIFY_STATUS_LABEL[status]}
            </Badge>
            <Badge
              variant="outline"
              className={
                form.mode === "live"
                  ? "bg-rose-500/15 text-rose-300 border-rose-500/30"
                  : "bg-sky-500/15 text-sky-300 border-sky-500/30"
              }
            >
              {form.mode === "live" ? (
                <Zap className="h-3 w-3 mr-1" />
              ) : (
                <Beaker className="h-3 w-3 mr-1" />
              )}
              {form.mode === "live" ? "Live mode" : "Test mode"}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Linked account summary (post-verification) */}
        {data.accountId && (
          <div className="rounded-md border border-border bg-muted/30 p-4 flex items-start gap-3">
            <Building2 className="h-5 w-5 mt-0.5 text-primary shrink-0" />
            <div className="text-sm flex-1 min-w-0">
              <div className="font-medium truncate">
                {data.accountName ?? "Stripe account"}
              </div>
              <div className="text-muted-foreground text-xs mt-0.5 break-all">
                {data.accountId}
                {data.accountEmail ? ` · ${data.accountEmail}` : null}
              </div>
              {data.lastVerifiedAt && (
                <div className="text-muted-foreground text-xs mt-1">
                  Last verified{" "}
                  {new Date(data.lastVerifiedAt).toLocaleString()}
                </div>
              )}
            </div>
            <a
              href="https://dashboard.stripe.com"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-primary hover:underline flex items-center gap-1 shrink-0"
            >
              Open Stripe <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}

        {/* Enabled / mode controls */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center justify-between rounded-md border border-border p-4">
            <div className="min-w-0 pr-3">
              <Label className="font-medium">Accept payments</Label>
              <p className="text-xs text-muted-foreground mt-1">
                {scope === "platform"
                  ? "Charge cemetery operators their plan fees through Stripe."
                  : "Allow your families and customers to pay you online."}
              </p>
            </div>
            <Switch
              checked={form.enabled}
              onCheckedChange={(v) => setField("enabled", v)}
              data-testid={`payment-enabled-${scope}`}
            />
          </div>
          <div className="rounded-md border border-border p-4 space-y-2">
            <Label>Mode</Label>
            <Select
              value={form.mode}
              onValueChange={(v) => setField("mode", v as "test" | "live")}
            >
              <SelectTrigger data-testid={`payment-mode-${scope}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="test">Test (sandbox)</SelectItem>
                <SelectItem value="live">Live (production)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Use test keys to validate setup; switch to live before charging
              real cards.
            </p>
          </div>
        </div>

        <Separator />

        {/* Stripe API keys */}
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold">API keys</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Find these in your Stripe Dashboard under{" "}
              <a
                className="text-primary hover:underline"
                href="https://dashboard.stripe.com/apikeys"
                target="_blank"
                rel="noreferrer"
              >
                Developers → API keys
              </a>
              . Test keys start with <code>pk_test_</code> /{" "}
              <code>sk_test_</code>; live keys with <code>pk_live_</code> /{" "}
              <code>sk_live_</code>.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`pk-${scope}`}>Publishable key</Label>
            <Input
              id={`pk-${scope}`}
              value={form.publishableKey}
              onChange={(e) => setField("publishableKey", e.target.value)}
              placeholder={
                form.mode === "live" ? "pk_live_…" : "pk_test_…"
              }
              data-testid={`payment-pk-${scope}`}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`sk-${scope}`}>Secret key</Label>
            <div className="flex gap-2">
              <Input
                id={`sk-${scope}`}
                type={showSecret ? "text" : "password"}
                value={form.secretKey}
                onChange={(e) => setField("secretKey", e.target.value)}
                placeholder={
                  data.hasSecretKey
                    ? "Leave masked value to keep current key"
                    : form.mode === "live"
                      ? "sk_live_…"
                      : "sk_test_…"
                }
                data-testid={`payment-sk-${scope}`}
                autoComplete="new-password"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setShowSecret((s) => !s)}
                aria-label={showSecret ? "Hide secret key" : "Show secret key"}
              >
                {showSecret ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Stored encrypted at rest in production. Never share this key.
            </p>
          </div>

          <div className="space-y-2">
            <Label
              htmlFor={`wh-${scope}`}
              className="flex items-center gap-1"
            >
              <Webhook className="h-3 w-3" /> Webhook signing secret
            </Label>
            <div className="flex gap-2">
              <Input
                id={`wh-${scope}`}
                type={showWebhook ? "text" : "password"}
                value={form.webhookSecret}
                onChange={(e) => setField("webhookSecret", e.target.value)}
                placeholder={
                  data.hasWebhookSecret
                    ? "Leave masked value to keep current secret"
                    : "whsec_…"
                }
                data-testid={`payment-wh-${scope}`}
                autoComplete="new-password"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setShowWebhook((s) => !s)}
                aria-label={
                  showWebhook ? "Hide webhook secret" : "Show webhook secret"
                }
              >
                {showWebhook ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Add an endpoint in Stripe pointing to{" "}
              <code className="text-foreground/80">
                {scope === "platform"
                  ? "/api/webhooks/stripe/platform"
                  : "/api/webhooks/stripe/org"}
              </code>{" "}
              and paste the signing secret here.
            </p>
          </div>
        </div>

        <Separator />

        {/* Display preferences */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={`cur-${scope}`}>Default currency</Label>
            <Select
              value={form.defaultCurrency}
              onValueChange={(v) => setField("defaultCurrency", v)}
            >
              <SelectTrigger
                id={`cur-${scope}`}
                data-testid={`payment-currency-${scope}`}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COMMON_CURRENCIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`sd-${scope}`}>Statement descriptor</Label>
            <Input
              id={`sd-${scope}`}
              value={form.statementDescriptor}
              maxLength={22}
              onChange={(e) =>
                setField("statementDescriptor", e.target.value)
              }
              placeholder="Up to 22 characters"
              data-testid={`payment-descriptor-${scope}`}
            />
            <p className="text-xs text-muted-foreground">
              Shown on customers' card statements.
            </p>
          </div>
        </div>

        {/* Verification feedback */}
        {verifyResult && verifyResult.status !== "ok" && (
          <div className="rounded-md border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              <div className="font-medium">
                {VERIFY_STATUS_LABEL[verifyResult.status]}
              </div>
              {verifyResult.message && (
                <div className="text-xs mt-1 opacity-90">
                  {verifyResult.message}
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>

      <div className="flex flex-wrap items-center justify-end gap-2 px-6 py-4 border-t border-border bg-muted/20">
        <Button
          variant="outline"
          onClick={onTest}
          disabled={testMut.isPending || !data.hasSecretKey || dirty}
          data-testid={`payment-test-${scope}`}
        >
          {testMut.isPending ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4 mr-1" />
          )}
          Test connection
        </Button>
        <Button
          onClick={onSave}
          disabled={!dirty || updateMut.isPending}
          data-testid={`payment-save-${scope}`}
        >
          {updateMut.isPending ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : null}
          Save changes
        </Button>
      </div>
    </Card>
  );
}
