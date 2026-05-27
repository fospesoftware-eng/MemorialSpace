// Helpers for the marketplace "schedule delivery" feature. Pure date math —
// no React, no I/O — so we can unit-test it cheaply and reuse it from any
// component that needs to show "next anniversary" / "next holiday".
//
// All occasions resolve to a calendar date in YYYY-MM-DD form (the same
// shape the server validates and stores). When today's date already
// matches the occasion we return today; otherwise we always return a
// FUTURE date (this year's instance if it hasn't passed, otherwise next
// year's). That way the UI can show "next: May 11, 2026" without the
// user ever picking a past date by accident.

export type ScheduleOccasion =
  | "death_anniversary"
  | "birthday"
  | "memorial_day"
  | "mothers_day"
  | "fathers_day"
  | "christmas"
  | "valentines"
  | "easter"
  | "custom";

export type OccasionResolution = {
  occasion: ScheduleOccasion;
  date: string; // YYYY-MM-DD
  label: string; // human-friendly, e.g. "Death anniversary — May 11, 2026"
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toIso(y: number, m: number, d: number): string {
  return `${y}-${pad(m)}-${pad(d)}`;
}

function todayLocal(): { y: number; m: number; d: number } {
  const now = new Date();
  return { y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() };
}

function isOnOrAfterToday(y: number, m: number, d: number): boolean {
  const t = todayLocal();
  if (y !== t.y) return y > t.y;
  if (m !== t.m) return m > t.m;
  return d >= t.d;
}

// True for years that have a Feb 29.
function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

// Adjust a (month, day) into a real calendar date for the given year.
// The only ambiguous case in the Gregorian calendar is Feb 29 — for
// people born/died on a leap day we fall back to Feb 28 in non-leap
// years (a common civil convention; the alternative, Mar 1, would
// confuse families who explicitly chose the anniversary date).
function realDateForYear(year: number, month: number, day: number): { month: number; day: number } {
  if (month === 2 && day === 29 && !isLeapYear(year)) {
    return { month: 2, day: 28 };
  }
  return { month, day };
}

// Given a month/day, return this year's instance if still in the future
// (or today), otherwise next year's. This is the canonical "next occurrence"
// calculation for any annually-recurring date. Feb 29 is mapped to Feb 28
// in non-leap years so we never return an impossible calendar date.
export function nextOccurrence(month: number, day: number): string {
  const t = todayLocal();
  const thisYearReal = realDateForYear(t.y, month, day);
  if (isOnOrAfterToday(t.y, thisYearReal.month, thisYearReal.day)) {
    return toIso(t.y, thisYearReal.month, thisYearReal.day);
  }
  const nextYearReal = realDateForYear(t.y + 1, month, day);
  return toIso(t.y + 1, nextYearReal.month, nextYearReal.day);
}

// Returns the day-of-month of the Nth weekday of a given month/year.
// `weekday` uses the JS convention (0 = Sun, 1 = Mon, ..., 6 = Sat).
function nthWeekdayOfMonth(
  year: number,
  month: number, // 1-12
  weekday: number,
  n: number,
): number {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const offset = (weekday - first.getUTCDay() + 7) % 7;
  return 1 + offset + (n - 1) * 7;
}

function lastWeekdayOfMonth(year: number, month: number, weekday: number): number {
  // Try the 5th occurrence — if it falls in the month, use it; else use 4th.
  const candidate = nthWeekdayOfMonth(year, month, weekday, 5);
  // Days in month: use Date with day=0 of next month.
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return candidate > days ? candidate - 7 : candidate;
}

// Anonymous Gregorian computus — returns YYYY-MM-DD for Easter Sunday.
function easterSunday(year: number): { month: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

function nextAnnualHoliday(monthDayResolver: (year: number) => { month: number; day: number }): string {
  const t = todayLocal();
  const thisYear = monthDayResolver(t.y);
  if (isOnOrAfterToday(t.y, thisYear.month, thisYear.day)) {
    return toIso(t.y, thisYear.month, thisYear.day);
  }
  const next = monthDayResolver(t.y + 1);
  return toIso(t.y + 1, next.month, next.day);
}

// Extract month/day from an ISO date string (YYYY-MM-DD). Returns null for
// malformed input — callers should treat null as "anniversary unavailable".
function monthDayFromIso(iso: string | null | undefined): { month: number; day: number } | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { month, day };
}

const HOLIDAY_RESOLVERS: Record<
  Exclude<ScheduleOccasion, "death_anniversary" | "birthday" | "custom">,
  (year: number) => { month: number; day: number }
> = {
  // US Memorial Day — last Monday of May.
  memorial_day: (y) => ({ month: 5, day: lastWeekdayOfMonth(y, 5, 1) }),
  // Mother's Day (US) — 2nd Sunday of May.
  mothers_day: (y) => ({ month: 5, day: nthWeekdayOfMonth(y, 5, 0, 2) }),
  // Father's Day (US) — 3rd Sunday of June.
  fathers_day: (y) => ({ month: 6, day: nthWeekdayOfMonth(y, 6, 0, 3) }),
  christmas: () => ({ month: 12, day: 25 }),
  valentines: () => ({ month: 2, day: 14 }),
  easter: easterSunday,
};

export const OCCASION_LABELS: Record<ScheduleOccasion, string> = {
  death_anniversary: "Death anniversary",
  birthday: "Birthday",
  memorial_day: "Memorial Day",
  mothers_day: "Mother's Day",
  fathers_day: "Father's Day",
  christmas: "Christmas",
  valentines: "Valentine's Day",
  easter: "Easter Sunday",
  custom: "Custom date",
};

export function formatIsoDate(iso: string): string {
  // YYYY-MM-DD → "May 11, 2026". Built without locale for predictable test
  // output and to avoid bundling Intl polyfills.
  const md = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!md) return iso;
  const y = Number(md[1]);
  const m = Number(md[2]);
  const d = Number(md[3]);
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `${months[m - 1]} ${d}, ${y}`;
}

export type DeceasedDates = {
  bornDate?: string | null;
  diedDate?: string | null;
};

// Resolve a single occasion to its next-occurrence date. Returns null when
// the occasion can't be resolved (e.g. anniversary requested without a
// known died-date).
export function resolveOccasion(
  occasion: ScheduleOccasion,
  deceased: DeceasedDates,
): OccasionResolution | null {
  if (occasion === "custom") {
    // The caller supplies the date, not us.
    return null;
  }
  let date: string | null = null;
  if (occasion === "death_anniversary") {
    const md = monthDayFromIso(deceased.diedDate);
    if (!md) return null;
    date = nextOccurrence(md.month, md.day);
  } else if (occasion === "birthday") {
    const md = monthDayFromIso(deceased.bornDate);
    if (!md) return null;
    date = nextOccurrence(md.month, md.day);
  } else {
    date = nextAnnualHoliday(HOLIDAY_RESOLVERS[occasion]);
  }
  return {
    occasion,
    date,
    label: `${OCCASION_LABELS[occasion]} — ${formatIsoDate(date)}`,
  };
}

// All available occasions for the cart's date selector, in display order.
// Death-anniversary / birthday options are filtered out when we don't have
// the corresponding deceased date.
export function availableOccasions(deceased: DeceasedDates): ScheduleOccasion[] {
  const out: ScheduleOccasion[] = [];
  if (monthDayFromIso(deceased.diedDate)) out.push("death_anniversary");
  if (monthDayFromIso(deceased.bornDate)) out.push("birthday");
  out.push(
    "memorial_day",
    "mothers_day",
    "fathers_day",
    "christmas",
    "valentines",
    "easter",
    "custom",
  );
  return out;
}
