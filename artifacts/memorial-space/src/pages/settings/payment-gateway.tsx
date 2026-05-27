/**
 * Cemetery Owner → Settings → Payment Gateway page.
 *
 * Configures *this organization's* own Stripe account so the cemetery can
 * accept online payments from families and customers (plot purchases,
 * memorial services, marketplace orders, etc.). Funds settle directly to
 * the cemetery operator's bank — MemorialSpace does not hold customer money.
 */
import { Building2, Info } from "lucide-react";
import { PaymentGatewayCard } from "@/components/payment-gateway-card";

export default function OrgPaymentGatewayPage() {
  return (
    <div className="container mx-auto py-8 max-w-4xl space-y-6">
      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-semibold tracking-tight">
            Payment Gateway
          </h1>
        </div>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Connect your cemetery's Stripe account so families and customers can
          pay you online for plots, memorials, services, and marketplace
          orders. Money settles directly to your bank account — MemorialSpace
          never touches customer payments.
        </p>
      </header>

      <div className="rounded-md border border-sky-500/30 bg-sky-500/10 p-3 text-sm text-sky-100 flex items-start gap-2">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <div>
          <div className="font-medium">Don't have a Stripe account yet?</div>
          <p className="text-xs mt-1 opacity-90">
            Create one for free at{" "}
            <a
              className="underline hover:text-white"
              href="https://dashboard.stripe.com/register"
              target="_blank"
              rel="noreferrer"
            >
              dashboard.stripe.com/register
            </a>
            . Once activated, copy your API keys from Developers → API keys
            and paste them below. Use test keys first to validate the
            integration.
          </p>
        </div>
      </div>

      <PaymentGatewayCard
        scope="org"
        intro="Stripe credentials for this cemetery. Used to charge families and customers for plots, services, and marketplace orders."
      />
    </div>
  );
}
