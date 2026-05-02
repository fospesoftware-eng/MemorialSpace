import { Shield, BarChart3, LifeBuoy, Lock } from "lucide-react";
import { SignInForm } from "./sign-in-form";

export default function SignInAdmin() {
  return (
    <SignInForm
      portalLabel="Platform Super Admin"
      title="Restricted access"
      subtitle="Internal MemorialSpace staff only. Multi-factor authentication required."
      theme="gold"
      demoEmail="admin@memorialspace.com"
      demoPassword="SuperAdmin2026!"
      redirectTo="/admin"
      signUpLabel="Not a staff member?"
      signUpHref="/"
      rightPanel={
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#d4a843]/30 bg-[#d4a843]/5 px-3 py-1 text-xs text-[#d4a843] font-semibold uppercase tracking-widest">
            <Shield className="h-3.5 w-3.5" />
            Super Admin
          </div>
          <h2 className="text-3xl font-bold leading-tight tracking-tight">
            Operate the platform that powers <span className="text-[#d4a843]">322</span> cemeteries.
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            MRR, organizations, users, billing, support tickets — everything you need to keep
            MemorialSpace running smoothly for our customers and their families.
          </p>
          <ul className="space-y-3 text-sm">
            {[
              { icon: BarChart3, text: "Real-time MRR & growth analytics" },
              { icon: LifeBuoy, text: "Triage & resolve cross-tenant support tickets" },
              { icon: Lock, text: "Full audit trail with role-based controls" },
            ].map(({ icon: Icon, text }, i) => (
              <li key={i} className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-md bg-[#d4a843]/10 border border-[#d4a843]/30 flex items-center justify-center">
                  <Icon className="h-4 w-4 text-[#d4a843]" />
                </div>
                <span className="text-foreground/80">{text}</span>
              </li>
            ))}
          </ul>
          <div className="mt-6 rounded-lg border border-[#d4a843]/20 bg-[#d4a843]/5 p-3">
            <p className="text-xs text-[#d4a843] font-semibold uppercase tracking-widest">Production environment</p>
            <p className="text-xs text-muted-foreground mt-1">All actions are logged and auditable.</p>
          </div>
        </div>
      }
    />
  );
}
