import { useEffect, useState } from "react";
import { Link } from "wouter";
import { CheckCircle2, Calendar, Repeat } from "lucide-react";
import { THEMES, isThemeKey, type ThemeKey } from "./themes";
import type { PublicSite } from "./api";
import { formatIsoDate, OCCASION_LABELS, type ScheduleOccasion } from "./schedule-helpers";

type Props = { slug: string; site: PublicSite; orderNumber: string };

// Confirmation details for the order we just placed. The submit-order
// mutation stores them in sessionStorage on success so a refresh of this
// page still shows the scheduled date. We tolerate any missing/expired
// data by silently rendering the bare confirmation.
type ConfirmedSchedule = {
  scheduledFor?: string | null;
  scheduleOccasion?: string | null;
  recurringYearly?: boolean;
};

const SCHEDULE_KEY = (slug: string, orderNumber: string) =>
  `cemetery-order-schedule:${slug}:${orderNumber}`;

export function setOrderConfirmation(
  slug: string,
  orderNumber: string,
  payload: ConfirmedSchedule,
) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      SCHEDULE_KEY(slug, orderNumber),
      JSON.stringify(payload),
    );
  } catch {
    /* storage disabled — confirmation just won't survive a refresh */
  }
}

function readOrderConfirmation(
  slug: string,
  orderNumber: string,
): ConfirmedSchedule | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(SCHEDULE_KEY(slug, orderNumber));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed as ConfirmedSchedule;
  } catch {
    /* ignore */
  }
  return null;
}

export function CemeterySiteSuccess({ slug, site, orderNumber }: Props) {
  const themeKey: ThemeKey = isThemeKey(site.theme) ? site.theme : "classic-marble";
  const theme = THEMES[themeKey];
  const headingFont = { fontFamily: theme.fontHeading };

  const [confirmation, setConfirmation] = useState<ConfirmedSchedule | null>(null);
  useEffect(() => {
    setConfirmation(readOrderConfirmation(slug, orderNumber));
  }, [slug, orderNumber]);

  const scheduledLabel = (() => {
    if (!confirmation?.scheduledFor) return null;
    const occ = confirmation.scheduleOccasion as ScheduleOccasion | null | undefined;
    const occLabel = occ && occ in OCCASION_LABELS ? OCCASION_LABELS[occ] : null;
    return {
      date: formatIsoDate(confirmation.scheduledFor),
      reason: occLabel,
      recurring: !!confirmation.recurringYearly,
    };
  })();

  return (
    <div className="container mx-auto max-w-2xl px-4 sm:px-6 py-20 text-center">
      <CheckCircle2
        className="h-20 w-20 mx-auto mb-6"
        style={{ color: "hsl(var(--site-primary))" }}
      />
      <h1 style={headingFont} className="text-4xl md:text-5xl font-semibold mb-4">
        Thank you
      </h1>
      <p
        style={{ color: "hsl(var(--site-muted-fg))" }}
        className="text-lg mb-8 max-w-md mx-auto"
      >
        Your order request has been received. We'll be in touch within one business
        day to confirm details and arrange payment.
      </p>
      <div
        style={{
          background: "hsl(var(--site-card))",
          border: "1px solid hsl(var(--site-border))",
          borderRadius: "var(--site-radius)",
        }}
        className="inline-block px-6 py-4 mb-10"
        data-testid="order-confirmation"
      >
        <div
          className="text-xs uppercase tracking-widest font-semibold mb-1"
          style={{ color: "hsl(var(--site-muted-fg))" }}
        >
          Order number
        </div>
        <div
          className="text-2xl font-mono font-semibold"
          style={{ color: "hsl(var(--site-primary))" }}
          data-testid="order-number"
        >
          {orderNumber}
        </div>
        {scheduledLabel ? (
          <div
            className="mt-4 pt-4 text-sm"
            style={{ borderTop: "1px solid hsl(var(--site-border))" }}
            data-testid="order-schedule-confirmation"
          >
            <div className="flex items-center justify-center gap-1.5 font-semibold">
              <Calendar className="h-4 w-4" style={{ color: "hsl(var(--site-primary))" }} />
              <span>Scheduled for {scheduledLabel.date}</span>
            </div>
            {scheduledLabel.reason ? (
              <div
                className="text-xs mt-1"
                style={{ color: "hsl(var(--site-muted-fg))" }}
              >
                {scheduledLabel.reason}
              </div>
            ) : null}
            {scheduledLabel.recurring ? (
              <div
                className="text-xs mt-1 flex items-center justify-center gap-1"
                style={{ color: "hsl(var(--site-muted-fg))" }}
                data-testid="order-schedule-recurring"
              >
                <Repeat className="h-3 w-3" />
                Repeating every year on this date
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-3 justify-center">
        <Link
          href={`/`}
          style={{
            background: "hsl(var(--site-primary))",
            color: "hsl(var(--site-primary-fg))",
            borderRadius: "var(--site-radius)",
          }}
          className="px-6 py-3 font-semibold hover:opacity-90 transition-opacity"
        >
          Back to home
        </Link>
        <Link
          href={`/marketplace`}
          style={{
            border: "1px solid hsl(var(--site-border))",
            color: "hsl(var(--site-fg))",
            borderRadius: "var(--site-radius)",
          }}
          className="px-6 py-3 font-semibold hover:opacity-80 transition-opacity"
        >
          Continue browsing
        </Link>
      </div>
    </div>
  );
}
