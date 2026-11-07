import { DEMO_DATE, daysUntil, demoNow, parseDate, toDateStr } from "./dates";
import type { CheckInFeedItem, Row } from "./derive";
import { readinessBreakdown, recommendedFollowUp } from "./derive";
import { READINESS_ITEMS } from "./questions";
import type { Status } from "../types";

export interface CalendarSurgeryEvent {
  patientId: string;
  patientName: string;
  procedure: string;
  site: string;
  status: Status;
  readyCount: number;
  totalCount: number;
  missingLabels: string[];
  missingDetail: string | null;
  followUp: string;
  daysFromToday: number;
}

export interface CalendarDayData {
  date: string;
  surgeries: CalendarSurgeryEvent[];
  checkIns: CheckInFeedItem[];
  hasReadinessIssue: boolean;
  hasUrgentCheckIn: boolean;
  hasClinicalSignal: boolean;
}

export interface CalendarCell extends CalendarDayData {
  dayOfMonth: number;
  inCurrentPeriod: boolean;
  isToday: boolean;
  /** True for DEMO_DATE .. DEMO_DATE + 7 days (urgent pre-op readiness window). */
  isImminentWindow: boolean;
  /** Band membership for the active calendar lens ("schedule" | "checkins"). */
  inBand: boolean;
  bandTone: "imminent" | "surgical-cluster" | "checkin-cluster" | null;
}

export type CalendarLens = "schedule" | "checkins";

/** Monday-first weekday headers matching the Google Health calendar geometry. */
export const WEEKDAY_HEADERS = [
  { short: "M", full: "Monday" },
  { short: "T", full: "Tuesday" },
  { short: "W", full: "Wednesday" },
  { short: "T", full: "Thursday" },
  { short: "F", full: "Friday" },
  { short: "S", full: "Saturday" },
  { short: "S", full: "Sunday" },
] as const;

/** Convert JS Sunday-0 day index to Monday-0 index (0 = Mon .. 6 = Sun). */
export function mondayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

/** Return the ISO date string for the Monday of the week containing `dateStr`. */
export function startOfMondayWeek(dateStr: string): string {
  const d = parseDate(dateStr);
  const offset = mondayIndex(d);
  return toDateStr(new Date(d.getFullYear(), d.getMonth(), d.getDate() - offset));
}

export function addDays(dateStr: string, delta: number): string {
  const d = parseDate(dateStr);
  return toDateStr(new Date(d.getFullYear(), d.getMonth(), d.getDate() + delta));
}

/**
 * Aggregate all scheduled surgeries and check-in events by ISO date (`YYYY-MM-DD`)
 * strictly from the live patient rows and derived check-in feed.
 */
export function buildCalendarEventMap(
  rows: Row[],
  checkInFeed: CheckInFeedItem[],
  now = demoNow(),
): Map<string, CalendarDayData> {
  const map = new Map<string, CalendarDayData>();

  const ensure = (date: string): CalendarDayData => {
    let existing = map.get(date);
    if (!existing) {
      existing = {
        date,
        surgeries: [],
        checkIns: [],
        hasReadinessIssue: false,
        hasUrgentCheckIn: false,
        hasClinicalSignal: false,
      };
      map.set(date, existing);
    }
    return existing;
  };

  for (const { patient: p, result } of rows) {
    if (!p.surgeryDate) continue;
    const entry = ensure(p.surgeryDate);
    const rb = readinessBreakdown(p.readiness);
    const missingItems = p.readiness.filter((r) => r.state === "missing");
    const missingLabels = missingItems.map(
      (m) =>
        READINESS_ITEMS.find((def) => def.key === m.key)?.missing ??
        "Missing item",
    );
    const firstDetail = missingItems.find((m) => m.detail)?.detail ?? null;
    entry.surgeries.push({
      patientId: p.id,
      patientName: p.name,
      procedure: p.procedure,
      site: p.site.replace(" Hospital", ""),
      status: result.status,
      readyCount: rb.ready,
      totalCount: rb.total,
      missingLabels,
      missingDetail: firstDetail,
      followUp: recommendedFollowUp(p, result),
      daysFromToday: daysUntil(p.surgeryDate, now),
    });
    if (missingLabels.length > 0) {
      entry.hasReadinessIssue = true;
    }
  }

  for (const item of checkInFeed) {
    const entry = ensure(item.checkIn.date);
    entry.checkIns.push(item);
    if (item.category === "urgent") {
      entry.hasUrgentCheckIn = true;
    } else if (
      item.category === "clinical-change" ||
      item.category === "missed"
    ) {
      entry.hasClinicalSignal = true;
    }
  }

  return map;
}

function classifyBand(
  date: string,
  eventMap: Map<string, CalendarDayData>,
  lens: CalendarLens,
  now: Date,
): { inBand: boolean; bandTone: CalendarCell["bandTone"] } {
  const dUntil = daysUntil(date, now);
  if (lens === "schedule") {
    // 7-day statutory urgent surgical readiness horizon (Nov 7 .. Nov 13 inclusive: 7 days)
    if (dUntil >= 0 && dUntil <= 6) {
      return { inBand: true, bandTone: "imminent" };
    }
    // Consecutive multi-day scheduled surgical sequence (e.g. Nov 25 & Nov 26)
    const curHasSurgery = (eventMap.get(date)?.surgeries.length ?? 0) > 0;
    if (curHasSurgery) {
      const prevHas =
        (eventMap.get(addDays(date, -1))?.surgeries.length ?? 0) > 0;
      const nextHas =
        (eventMap.get(addDays(date, 1))?.surgeries.length ?? 0) > 0;
      if (prevHas || nextHas) {
        return { inBand: true, bandTone: "surgical-cluster" };
      }
    }
    return { inBand: false, bandTone: null };
  }

  // "checkins" lens: highlight consecutive days with recorded check-in activity
  const curHasCheckIn = (eventMap.get(date)?.checkIns.length ?? 0) > 0;
  if (curHasCheckIn) {
    const prevHas =
      (eventMap.get(addDays(date, -1))?.checkIns.length ?? 0) > 0;
    const nextHas =
      (eventMap.get(addDays(date, 1))?.checkIns.length ?? 0) > 0;
    if (prevHas || nextHas) {
      return { inBand: true, bandTone: "checkin-cluster" };
    }
  }
  return { inBand: false, bandTone: null };
}

function makeCell(
  date: string,
  inCurrentPeriod: boolean,
  eventMap: Map<string, CalendarDayData>,
  lens: CalendarLens,
  now: Date,
): CalendarCell {
  const d = parseDate(date);
  const data = eventMap.get(date);
  const dUntil = daysUntil(date, now);
  const { inBand, bandTone } = classifyBand(date, eventMap, lens, now);
  return {
    date,
    dayOfMonth: d.getDate(),
    inCurrentPeriod,
    isToday: date === toDateStr(now),
    isImminentWindow: dUntil >= 0 && dUntil <= 6,
    inBand,
    bandTone,
    surgeries: data?.surgeries ?? [],
    checkIns: data?.checkIns ?? [],
    hasReadinessIssue: data?.hasReadinessIssue ?? false,
    hasUrgentCheckIn: data?.hasUrgentCheckIn ?? false,
    hasClinicalSignal: data?.hasClinicalSignal ?? false,
  };
}

/** Build a 2-week (2 × 7 Monday-Sunday) compact calendar grid anchored on a Monday. */
export function buildTwoWeekGrid(
  mondayAnchor: string,
  eventMap: Map<string, CalendarDayData>,
  lens: CalendarLens = "schedule",
  now = demoNow(),
): CalendarCell[][] {
  const start = startOfMondayWeek(mondayAnchor);
  const weeks: CalendarCell[][] = [];
  for (let w = 0; w < 2; w++) {
    const row: CalendarCell[] = [];
    for (let c = 0; c < 7; c++) {
      const date = addDays(start, w * 7 + c);
      row.push(makeCell(date, true, eventMap, lens, now));
    }
    weeks.push(row);
  }
  return weeks;
}

/** Build a full Monday-Sunday month grid for expanded focus views. */
export function buildMonthGrid(
  year: number,
  monthIndex: number,
  eventMap: Map<string, CalendarDayData>,
  lens: CalendarLens = "schedule",
  now = demoNow(),
): CalendarCell[][] {
  const firstOfMonth = new Date(year, monthIndex, 1);
  const lastOfMonth = new Date(year, monthIndex + 1, 0);
  const startMonday = startOfMondayWeek(toDateStr(firstOfMonth));

  const weeks: CalendarCell[][] = [];
  let cursor = startMonday;
  while (true) {
    const row: CalendarCell[] = [];
    for (let c = 0; c < 7; c++) {
      const date = addDays(cursor, c);
      const d = parseDate(date);
      const inMonth = d.getFullYear() === year && d.getMonth() === monthIndex;
      row.push(makeCell(date, inMonth, eventMap, lens, now));
    }
    weeks.push(row);
    cursor = addDays(cursor, 7);
    if (parseDate(cursor).getTime() > lastOfMonth.getTime()) {
      break;
    }
  }
  return weeks;
}

/**
 * Prioritize upcoming scheduled procedures for the compact Surgery Readiness overview:
 * 1. Imminent surgeries within 7 days (e.g., Nov 10 Joshua Bird)
 * 2. Next chronological surgery so immediate upcoming schedule is clear (e.g., Nov 19 Helen Kowalchuk)
 * 3. Upcoming surgeries with unresolved readiness items (e.g., Nov 26 Grace Yousef)
 * 4. Remaining chronological booked procedures
 */
export function prioritizeUpcomingSurgeries(
  rows: Row[],
  limit = 3,
  now = demoNow(),
): Row[] {
  const scheduled = rows
    .filter(
      (r) =>
        r.patient.surgeryDate !== null &&
        daysUntil(r.patient.surgeryDate, now) >= 0,
    )
    .sort((a, b) =>
      a.patient.surgeryDate!.localeCompare(b.patient.surgeryDate!),
    );

  if (scheduled.length <= limit) return scheduled;

  const picked: Row[] = [];
  const pushUnique = (r: Row | undefined) => {
    if (r && !picked.some((x) => x.patient.id === r.patient.id)) {
      picked.push(r);
    }
  };

  // 1. Any imminent procedure (<= 7 days)
  for (const r of scheduled) {
    if (daysUntil(r.patient.surgeryDate!, now) <= 7) {
      pushUnique(r);
    }
  }

  // 2. Earliest upcoming procedure (ensures chronological continuity)
  for (const r of scheduled) {
    if (picked.length >= 2) break;
    pushUnique(r);
  }

  // 3. Any procedure with an open readiness blocker so no scheduled risk is hidden
  for (const r of scheduled) {
    if (picked.length >= limit) break;
    if (r.patient.readiness.some((i) => i.state === "missing")) {
      pushUnique(r);
    }
  }

  // 4. Fill remaining slots chronologically
  for (const r of scheduled) {
    if (picked.length >= limit) break;
    pushUnique(r);
  }

  return picked.sort((a, b) =>
    a.patient.surgeryDate!.localeCompare(b.patient.surgeryDate!),
  );
}

/** Return the most recent distinct check-in dates (up to `limit`) for the compact date filter strip. */
export function recentCheckInDates(
  checkInFeed: CheckInFeedItem[],
  limit = 4,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of checkInFeed) {
    if (!seen.has(item.checkIn.date)) {
      seen.add(item.checkIn.date);
      out.push(item.checkIn.date);
      if (out.length >= limit) break;
    }
  }
  return out;
}

export function defaultCalendarMonday(): string {
  return startOfMondayWeek(DEMO_DATE);
}

