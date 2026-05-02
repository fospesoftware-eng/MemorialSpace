import { Building2, MapPin, Users, ShieldCheck } from "lucide-react";
import { SignInForm } from "./sign-in-form";

export default function SignInCemetery() {
  return (
    <SignInForm
      portalLabel="Cemetery Operator"
      title="Welcome back"
      subtitle="Sign in to manage plots, burials, bookings, and memorial pages."
      theme="green"
      kind="cemetery"
      demoEmail="ops@riversidememorial.com"
      demoPassword="Cemetery2026!"
      redirectTo="/app/dashboard"
      signUpLabel="Don't have an account yet?"
      signUpHref="/#pricing"
      rightPanel={
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs text-primary font-semibold">
            <Building2 className="h-3.5 w-3.5" />
            Cemetery operations
          </div>
          <h2 className="text-3xl font-bold leading-tight tracking-tight">
            Run your grounds with the calm of a modern operating system.
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            322 cemeteries trust MemorialSpace to manage 148,000+ plots, sell services
            online, and keep families connected to those they love.
          </p>
          <ul className="space-y-3 text-sm">
            {[
              { icon: MapPin, text: "Interactive plot map with availability sync" },
              { icon: Users, text: "Burial, booking, and work-order workflows" },
              { icon: ShieldCheck, text: "SOC 2 Type II + GDPR compliant" },
            ].map(({ icon: Icon, text }, i) => (
              <li key={i} className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-md bg-primary/10 border border-primary/30 flex items-center justify-center">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <span className="text-foreground/80">{text}</span>
              </li>
            ))}
          </ul>
        </div>
      }
    />
  );
}
