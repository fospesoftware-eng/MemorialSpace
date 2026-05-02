import { Heart, MessageSquare, Bookmark, Flower } from "lucide-react";
import { SignInForm } from "./sign-in-form";

export default function SignInFamily() {
  return (
    <SignInForm
      portalLabel="Family Member"
      title="Welcome back"
      subtitle="Sign in to manage memorials, leave tributes, and access your saved records."
      theme="rose"
      demoEmail="sarah.chen@email.com"
      demoPassword="Demo2026!"
      redirectTo="/account"
      signUpLabel="New here?"
      signUpHref="/find"
      rightPanel={
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-rose-500/30 bg-rose-500/5 px-3 py-1 text-xs text-rose-400 font-semibold">
            <Heart className="h-3.5 w-3.5" />
            Family portal
          </div>
          <h2 className="text-3xl font-bold leading-tight tracking-tight">
            Stay close to those you love, wherever life takes you.
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Care for your family memorial pages, leave tributes, schedule flower
            deliveries, and keep treasured records in one private place.
          </p>
          <ul className="space-y-3 text-sm">
            {[
              { icon: Heart, text: "Manage memorial pages you own or co-care for" },
              { icon: MessageSquare, text: "Read and respond to tributes from loved ones" },
              { icon: Bookmark, text: "Saved records & visit reminders" },
              { icon: Flower, text: "Place orders for flowers, candles & care plans" },
            ].map(({ icon: Icon, text }, i) => (
              <li key={i} className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-md bg-rose-500/10 border border-rose-500/30 flex items-center justify-center">
                  <Icon className="h-4 w-4 text-rose-400" />
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
