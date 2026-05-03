import { SignInForm } from "./sign-in-form";
import { Store, Inbox, Wrench, Globe2 } from "lucide-react";

/**
 * Sign-in page for marketplace vendors. Re-uses the shared SignInForm with
 * the gold theme (vendors aren't cemetery operators, so the green B2B brand
 * doesn't fit; gold reads as "merchant"). Demo credentials are seeded by
 * `scripts/src/seed-vendors.ts`.
 */
export default function SignInVendor() {
  return (
    <SignInForm
      portalLabel="Vendor portal"
      title="Sign in to your vendor dashboard"
      subtitle="Manage requests, publish your services, and grow with families across the network."
      theme="gold"
      kind="vendor"
      demoEmail="florist@test.com"
      demoPassword="password123"
      redirectTo="/vendor"
      signUpHref="/vendor/signup"
      signUpLabel="New vendor?"
      rightPanel={
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#d4a843]/30 bg-[#d4a843]/5 px-3 py-1 text-[11px] uppercase tracking-widest font-semibold text-[#d4a843]">
            <Store className="h-3 w-3" />
            For service providers
          </div>
          <h2 className="text-3xl font-bold leading-tight">Reach families exactly when they need you.</h2>
          <p className="text-sm text-muted-foreground">
            Florists, monument carvers, transport, catering — list your services, set your service areas,
            and accept requests from families across our cemetery network.
          </p>
          <ul className="space-y-3 text-sm">
            <li className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-md bg-[#d4a843]/10 text-[#d4a843] flex items-center justify-center shrink-0">
                <Inbox className="h-4 w-4" />
              </div>
              <div>
                <p className="font-medium">Real-time request inbox</p>
                <p className="text-xs text-muted-foreground">Accept, decline, or complete requests in one click.</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-md bg-[#d4a843]/10 text-[#d4a843] flex items-center justify-center shrink-0">
                <Wrench className="h-4 w-4" />
              </div>
              <div>
                <p className="font-medium">Publish your service catalog</p>
                <p className="text-xs text-muted-foreground">Photos, descriptions, and price bands for each offering.</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-md bg-[#d4a843]/10 text-[#d4a843] flex items-center justify-center shrink-0">
                <Globe2 className="h-4 w-4" />
              </div>
              <div>
                <p className="font-medium">Define your service area</p>
                <p className="text-xs text-muted-foreground">Only show up to families inside the regions you cover.</p>
              </div>
            </li>
          </ul>
        </div>
      }
    />
  );
}
