export const DEMO_DATE = "2026-11-07";
/** Fixed local demo clock, independent of the presentation device date. */
export const demoNow = () => new Date(2026, 10, 7, 9, 41);

const DAY = 86_400_000;

function localMidnight(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function toDateStr(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Date string n days before today (negative n = in the future). */
export function daysAgo(n: number, now = demoNow()): string {
  return toDateStr(
    new Date(now.getFullYear(), now.getMonth(), now.getDate() - n),
  );
}

export function daysFromNow(n: number, now = demoNow()): string {
  return daysAgo(-n, now);
}

/** Whole days from today until the date (negative if in the past). */
export function daysUntil(s: string, now = demoNow()): number {
  return Math.round(
    (parseDate(s).getTime() - localMidnight(now).getTime()) / DAY,
  );
}

export function daysSince(s: string, now = demoNow()): number {
  return -daysUntil(s, now);
}

export function fmtDate(s: string, opts: { year?: boolean } = {}): string {
  return parseDate(s).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(opts.year === false ? {} : { year: "numeric" }),
  });
}

export function fmtMonthYear(s: string): string {
  return parseDate(s).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
}

export function fmtTime(d: Date): string {
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function fmtTimestamp(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })} · ${fmtTime(d)}`;
}

/** "today", "in 3 days", "3 days ago" */
export function relDays(s: string, now = demoNow()): string {
  const n = daysUntil(s, now);
  if (n === 0) return "today";
  if (n === 1) return "tomorrow";
  if (n === -1) return "yesterday";
  return n > 0 ? `in ${n} days` : `${-n} days ago`;
}
