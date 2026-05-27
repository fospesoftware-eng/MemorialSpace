/**
 * Super Admin → Payment Gateway page.
 *
 * Configures the *platform* Stripe account that the SaaS company uses to
 * charge cemetery operators for their subscriptions. Per-org Stripe
 * accounts (used by operators to charge their own customers) are configured
 * separately on the B2B side at `/settings/payment-gateway`.
 */
import { Shield, Info } from "lucide-react";
import { PaymentGatewayCard } from "@/components/payment-gateway-card";

export default function AdminPaymentGatewayPage() {
  return (
    <div className="container mx-auto py-8 max-w-4xl space-y-6">
      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-[#d4a843]" />
          <h1 className="text-2xl font-semibold tracking-tight">
            Payment Gateway
          </h1>
        </div>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Connect MemorialSpace's own Stripe account. This gateway processes
          subscription payments from cemetery operators on the platform.
          Cemetery operators connect their own Stripe accounts separately to
          charge their families and customers.
        </p>
      </header>

      <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200 flex items-start gap-2">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <div>
          <div className="font-medium">Platform-level account</div>
          <p className="text-xs mt-1 opacity-90">
            All organization subscription invoices are charged here. Switch to
            live mode only when you're ready to process real subscription
            payments.
          </p>
        </div>
      </div>

      <PaymentGatewayCard
        scope="platform"
        intro="Stripe credentials for the MemorialSpace platform. Used to bill cemetery operators their plan and seat charges."
      />
    </div>
  );
}
