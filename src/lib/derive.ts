import {
  STATUS_RANK,
  answeredCheckIns,
  calculateStatus,
  daysSinceReply,
  latestAnswered,
} from "../calculateStatus";
import type {
  CheckIn,
  Mood,
  Patient,
  ReadinessItem,
  Status,
  StatusResult,
} from "../types";
import { daysUntil, demoNow, parseDate } from "./dates";
import { READINESS_ITEMS } from "./questions";

export interface Row {
  patient: Patient;
  result: StatusResult;
}

export function buildRows(patients: Patient[], now = demoNow()): Row[] {
  return patients
    .map((patient) => ({ patient, result: calculateStatus(patient, now) }))
    .sort((x, y) => {
      const s = STATUS_RANK[x.result.status] - STATUS_RANK[y.result.status];
      if (s) return s;
      const dx = x.patient.surgeryDate
        ? parseDate(x.patient.surgeryDate).getTime()
        : Infinity;
      const dy = y.patient.surgeryDate
        ? parseDate(y.patient.surgeryDate).getTime()
        : Infinity;
      if (dx !== dy) return dx - dy;
      return y.patient.weeksWaiting - x.patient.weeksWaiting;
    });
}

/** One-line plain-language summary of the latest check-in for the table. */
export function latestSummary(
  p: Patient,
  result: StatusResult,
  now = demoNow(),
): string {
  const codes = new Set(result.reasons.map((r) => r.code));
  const parts: string[] = [];
  const since = daysSinceReply(p, now);

  for (const r of result.reasons) {
    if (r.code.startsWith("readiness:")) parts.push(r.label.split(": ")[1]);
  }
  if (codes.has("no-reply")) {
    parts.push(
      since === null
        ? "no replies yet"
        : `no reply for ${since >= 21 ? `${Math.round(since / 7)} weeks` : `${since} days`}`,
    );
    return sentence(parts);
  }
  const last = latestAnswered(p);
  const a = last?.answers;
  if (!a) return sentence(parts) || "No check-ins yet";

  if (last.redFlag) parts.push(`reported ${last.redFlag}`);
  if (!a.wants) parts.push("may not want surgery");
  parts.push(
    codes.has("pain-up")
      ? `pain ${a.pain}/10 (was ${p.baseline.pain})`
      : `pain ${a.pain}/10`,
  );
  if (codes.has("walk-down"))
    parts.push(
      a.walk === 0
        ? "stopped walking"
        : `walking ${a.walk} days (was ${p.baseline.walk})`,
    );
  else
    parts.push(
      a.walk >= 7
        ? "walking daily"
        : `walking ${a.walk} ${a.walk === 1 ? "day" : "days"}/wk`,
    );
  if (codes.has("mood-low")) parts.push("mood low twice");
  if (codes.has("needs-info")) parts.push("needs surgery info");
  if (codes.has("needs-help") && !codes.has("readiness:ride"))
    parts.push("asked for help");
  return sentence(parts);
}

function sentence(parts: string[]): string {
  const s = parts.join(", ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function readinessCount(items: ReadinessItem[]) {
  const applicable = items.filter((i) => i.state !== "na");
  return {
    ready: applicable.filter((i) => i.state === "done").length,
    total: applicable.length,
  };
}

export function readinessBreakdown(items: ReadinessItem[]) {
  const applicable = items.filter((i) => i.state !== "na");
  return {
    ready: applicable.filter((i) => i.state === "done").length,
    missing: applicable.filter((i) => i.state === "missing").length,
    notDue: applicable.filter((i) => i.state === "notdue").length,
    na: items.filter((i) => i.state === "na").length,
    total: applicable.length,
  };
}

export interface Stats {
  total: number;
  act: number;
  watch: number;
  ok: number;
  noReply: number;
  surgeriesSoon: number;
}

export function computeStats(rows: Row[], now = demoNow()): Stats {
  return {
    total: rows.length,
    act: rows.filter((r) => r.result.status === "act").length,
    watch: rows.filter((r) => r.result.status === "watch").length,
    ok: rows.filter((r) => r.result.status === "ok").length,
    noReply: rows.filter((r) => isNoReply(r.patient, now)).length,
    surgeriesSoon: rows.filter((r) => isSurgerySoon(r.patient, now)).length,
  };
}

export interface OperationalMetrics extends Stats {
  attention: number;
  scheduled: number;
  readinessGaps: number;
  scheduledReadinessGaps: number;
  simulatedCount: number;
}

export function computeOperationalMetrics(
  rows: Row[],
  now = demoNow(),
): OperationalMetrics {
  const base = computeStats(rows, now);
  const scheduledRows = rows.filter((r) => r.patient.surgeryDate !== null);
  const readinessGaps = rows.filter((r) =>
    r.patient.readiness.some((i) => i.state === "missing"),
  ).length;
  const scheduledReadinessGaps = scheduledRows.filter((r) =>
    r.patient.readiness.some((i) => i.state === "missing"),
  ).length;
  const simulatedCount = rows.reduce(
    (acc, r) => acc + r.patient.checkIns.filter((c) => c.simulated).length,
    0,
  );
  return {
    ...base,
    attention: base.act + base.watch,
    scheduled: scheduledRows.length,
    readinessGaps,
    scheduledReadinessGaps,
    simulatedCount,
  };
}

export function isNoReply(p: Patient, now = demoNow()) {
  const s = daysSinceReply(p, now);
  return s === null || s >= 14;
}

export function isSurgerySoon(p: Patient, now = demoNow()) {
  if (!p.surgeryDate) return false;
  const d = daysUntil(p.surgeryDate, now);
  return d >= 0 && d <= 7;
}

export function hasReadinessGap(p: Patient) {
  return p.readiness.some((i) => i.state === "missing");
}

/** Plain-language required next action derived deterministically from active flags. */
export function recommendedFollowUp(p: Patient, result: StatusResult): string {
  const codes = new Set(result.reasons.map((r) => r.code));
  if (codes.has("red-flag")) {
    return "Immediate RN call · confirm 811 / emergency assessment";
  }
  if ([...codes].some((c) => c.startsWith("readiness:"))) {
    const missingItem = result.reasons.find((r) =>
      r.code.startsWith("readiness:"),
    );
    if (missingItem?.readinessKey === "ride") {
      return "Urgent pre-op call · arrange post-op ride home";
    }
    return "Urgent pre-op call · resolve missing readiness item";
  }
  if (codes.has("not-wanting")) {
    return "Call patient · confirm surgical intent & update OR booking";
  }
  if (codes.has("no-reply")) {
    return "Direct phone outreach · reconnect after missed check-ins";
  }
  if (codes.has("pain-up") && codes.has("walk-down")) {
    return "RN assessment call · review pain progression & mobility loss";
  }
  if (codes.has("pain-up")) {
    return "RN assessment call · review worsening pain";
  }
  if (codes.has("walk-down")) {
    return "RN check-in · assess mobility decline & prehab support";
  }
  if (codes.has("mood-low")) {
    return p.contactMethod === "caregiver"
      ? "Call caregiver & patient · review wellbeing & support options"
      : "Supportive RN call · review wellbeing & counselling referral";
  }
  if (codes.has("needs-help")) {
    return "Coordinate requested assistance / social work referral";
  }
  if (codes.has("needs-info")) {
    return "Send procedure & recovery planning information";
  }
  return "Continue scheduled biweekly check-ins";
}

export type MetricKey = "pain" | "walk" | "mood";

export interface TrendObservation {
  id: string;
  date: string;
  time: string;
  missed: boolean;
  simulated: boolean;
  pain: number | null;
  walk: number | null;
  mood: Mood | null;
  painFlagged: boolean;
  walkFlagged: boolean;
  moodLow: boolean;
  consecutiveLowGroup: boolean;
  rawPain?: string;
  rawWalk?: string;
  rawMood?: string;
  note?: string;
  redFlag?: string;
}

export interface PatientTrends {
  observations: TrendObservation[];
  answeredCount: number;
  missedCount: number;
  primaryMetric: MetricKey;
  pain: {
    current: number | null;
    baseline: number;
    delta: number | null;
    direction: "up" | "down" | "flat" | "none";
    flagged: boolean;
    headline: string;
    detail: string;
  };
  walk: {
    current: number | null;
    baseline: number;
    delta: number | null;
    direction: "up" | "down" | "flat" | "none";
    flagged: boolean;
    headline: string;
    detail: string;
  };
  mood: {
    current: Mood | null;
    baseline: Mood;
    consecutiveLow: number;
    flagged: boolean;
    headline: string;
    detail: string;
  };
}

export function computePatientTrends(p: Patient): PatientTrends {
  const answered = answeredCheckIns(p);
  const last = latestAnswered(p)?.answers ?? null;

  // Identify consecutive Low mood runs across answered check-ins so categorical
  // timeline capsules can group consecutive Low reports accurately.
  const lowRunIds = new Set<string>();
  for (let i = 0; i < answered.length; i++) {
    const cur = answered[i];
    if (cur.answers?.mood !== "Low") continue;
    const prevLow = i > 0 && answered[i - 1].answers?.mood === "Low";
    const nextLow =
      i + 1 < answered.length && answered[i + 1].answers?.mood === "Low";
    if (prevLow || nextLow) {
      lowRunIds.add(cur.id);
    }
  }

  let trailingLow = 0;
  for (let i = answered.length - 1; i >= 0; i--) {
    if (answered[i].answers?.mood === "Low") trailingLow++;
    else break;
  }

  const observations: TrendObservation[] = p.checkIns.map((c) => {
    const a = !c.missed && c.answers ? c.answers : null;
    return {
      id: c.id,
      date: c.date,
      time: c.time,
      missed: !!c.missed,
      simulated: !!c.simulated,
      pain: a ? a.pain : null,
      walk: a ? a.walk : null,
      mood: a ? a.mood : null,
      painFlagged: a ? a.pain - p.baseline.pain >= 2 : false,
      walkFlagged: a ? p.baseline.walk - a.walk >= 3 : false,
      moodLow: a ? a.mood === "Low" : false,
      consecutiveLowGroup: lowRunIds.has(c.id),
      rawPain: c.raw?.pain,
      rawWalk: c.raw?.walk,
      rawMood: c.raw?.mood,
      note: c.note,
      redFlag: c.redFlag,
    };
  });

  const painDelta = last ? last.pain - p.baseline.pain : null;
  const painFlagged = painDelta !== null && painDelta >= 2;
  const painHeadline =
    painDelta === null
      ? "No pain score recorded"
      : painDelta === 0
        ? `At baseline (${p.baseline.pain}/10)`
        : painDelta > 0
          ? `Up ${painDelta} ${painDelta === 1 ? "pt" : "pts"} from baseline`
          : `Down ${Math.abs(painDelta)} ${Math.abs(painDelta) === 1 ? "pt" : "pts"} from baseline`;
  const painDetail =
    last === null
      ? `Referral baseline ${p.baseline.pain}/10`
      : `Baseline ${p.baseline.pain}/10 → Current ${last.pain}/10`;

  const walkDelta = last ? last.walk - p.baseline.walk : null;
  const walkFlagged = walkDelta !== null && p.baseline.walk - last!.walk >= 3;
  const walkHeadline =
    last === null
      ? "No activity recorded"
      : last.walk === 0 && p.baseline.walk > 0
        ? `Stopped walking (was ${p.baseline.walk}d/wk)`
        : walkDelta === 0
          ? `At baseline (${p.baseline.walk} days/wk)`
          : walkDelta! > 0
            ? `Up ${walkDelta} ${walkDelta === 1 ? "day" : "days"}/wk`
            : `Down ${Math.abs(walkDelta!)} ${Math.abs(walkDelta!) === 1 ? "day" : "days"}/wk`;
  const walkDetail =
    last === null
      ? `Referral baseline ${p.baseline.walk} days/wk (15+ min)`
      : `Baseline ${p.baseline.walk}d/wk → Current ${last.walk}d/wk · 15+ min`;

  const moodFlagged = trailingLow >= 2;
  const moodHeadline =
    last === null
      ? "No mood report"
      : moodFlagged
        ? `Low for ${trailingLow} consecutive check-ins`
        : last.mood === p.baseline.mood
          ? `Consistent with baseline (${p.baseline.mood})`
          : `Reported ${last.mood} (baseline ${p.baseline.mood})`;
  const moodDetail =
    last === null
      ? `Referral baseline: ${p.baseline.mood}`
      : `Categorical self-report · Baseline ${p.baseline.mood}`;

  let primaryMetric: MetricKey = "pain";
  if (painFlagged) primaryMetric = "pain";
  else if (walkFlagged) primaryMetric = "walk";
  else if (moodFlagged) primaryMetric = "mood";
  else if (
    walkDelta !== null &&
    painDelta !== null &&
    Math.abs(walkDelta) > Math.abs(painDelta)
  ) {
    primaryMetric = "walk";
  }

  return {
    observations,
    answeredCount: answered.length,
    missedCount: p.checkIns.filter((c) => c.missed).length,
    primaryMetric,
    pain: {
      current: last?.pain ?? null,
      baseline: p.baseline.pain,
      delta: painDelta,
      direction:
        painDelta === null
          ? "none"
          : painDelta > 0
            ? "up"
            : painDelta < 0
              ? "down"
              : "flat",
      flagged: painFlagged,
      headline: painHeadline,
      detail: painDetail,
    },
    walk: {
      current: last?.walk ?? null,
      baseline: p.baseline.walk,
      delta: walkDelta,
      direction:
        walkDelta === null
          ? "none"
          : walkDelta > 0
            ? "up"
            : walkDelta < 0
              ? "down"
              : "flat",
      flagged: walkFlagged,
      headline: walkHeadline,
      detail: walkDetail,
    },
    mood: {
      current: last?.mood ?? null,
      baseline: p.baseline.mood,
      consecutiveLow: trailingLow,
      flagged: moodFlagged,
      headline: moodHeadline,
      detail: moodDetail,
    },
  };
}

export type CheckInEventCategory =
  | "urgent"
  | "clinical-change"
  | "missed"
  | "routine";

export interface CheckInFeedItem {
  checkIn: CheckIn;
  patient: Patient;
  patientStatus: Status;
  responseStatus: Status;
  category: CheckInEventCategory;
  categoryLabel: string;
  headline: string;
  subline: string;
  isLatestForPatient: boolean;
  reviewed: boolean;
}

export function buildCheckInFeed(
  rows: Row[],
  now = demoNow(),
): CheckInFeedItem[] {
  const items: (CheckInFeedItem & { idx: number })[] = [];

  for (const { patient: p, result } of rows) {
    p.checkIns.forEach((c, idx) => {
      const isLatest = idx === p.checkIns.length - 1;
      const pointInTimeStatus = calculateStatus(
        {
          ...p,
          checkIns: p.checkIns.slice(0, idx + 1),
          surgeryDate: isLatest ? p.surgeryDate : null,
          readiness: isLatest ? p.readiness : [],
          resolved: [],
        },
        isLatest ? now : parseDate(c.date),
      );

      const reviewed = p.activity.some(
        (a) => a.kind === "review" && a.checkInId === c.id,
      );

      let category: CheckInEventCategory = "routine";
      let categoryLabel = "Routine response";
      let headline = "";
      let subline = "";

      if (c.missed) {
        category = "missed";
        categoryLabel = "No response";
        headline = "Check-in unanswered";
        subline = isLatest && isNoReply(p, now)
          ? `Overdue 14+ days · patient flagged Watch`
          : "Automated reminder sent · no reply recorded";
      } else if (c.answers) {
        const a = c.answers;
        if (c.redFlag) {
          category = "urgent";
          categoryLabel = "Red-flag symptom";
          headline = `Reported ${c.redFlag} · HealthLine 811 guidance triggered`;
          subline = c.followUp
            ? `Follow-up recorded: ${c.followUp}`
            : c.note
              ? `“${c.note}”`
              : `Pain ${a.pain}/10 · Walk ${a.walk}d/wk · Mood ${a.mood}`;
        } else if (!a.wants) {
          category = "urgent";
          categoryLabel = "Preference change";
          headline = "Indicated may no longer want surgery";
          subline = c.note
            ? `“${c.note}”`
            : "Staff confirmation required before updating waitlist";
        } else if (
          isLatest &&
          p.surgeryDate &&
          daysUntil(p.surgeryDate, now) >= 0 &&
          daysUntil(p.surgeryDate, now) <= 7 &&
          p.readiness.some((r) => r.state === "missing")
        ) {
          const miss = p.readiness.find((r) => r.state === "missing")!;
          const label =
            READINESS_ITEMS.find((i) => i.key === miss.key)?.missing ??
            "readiness gap";
          category = "urgent";
          categoryLabel = "Pre-op risk";
          headline = `Surgery in ${daysUntil(p.surgeryDate, now)}d · ${label}`;
          subline = c.note
            ? `“${c.note}”`
            : `Pain ${a.pain}/10 · Walk ${a.walk}d/wk · Requested help: ${a.help ? "Yes" : "No"}`;
        } else if (pointInTimeStatus.reasons.length > 0) {
          category = "clinical-change";
          categoryLabel = "Clinical signal";
          headline = pointInTimeStatus.reasons.map((r) => r.label).join(" · ");
          subline = c.note
            ? `“${c.note}”`
            : `Pain ${a.pain}/10 · Walk ${a.walk}d/wk · Mood ${a.mood}`;
        } else {
          category = "routine";
          categoryLabel = "Within baseline";
          headline = `Pain ${a.pain}/10 · Walking ${a.walk}d/wk · Mood ${a.mood}`;
          subline = c.note
            ? `“${c.note}”`
            : `Baseline: Pain ${p.baseline.pain}/10, Walk ${p.baseline.walk}d/wk`;
        }
      }

      items.push({
        checkIn: c,
        patient: p,
        patientStatus: result.status,
        responseStatus: pointInTimeStatus.status,
        category,
        categoryLabel,
        headline,
        subline,
        isLatestForPatient: isLatest,
        reviewed,
        idx,
      });
    });
  }

  return items.sort(
    (a, b) =>
      b.checkIn.date.localeCompare(a.checkIn.date) ||
      Number(!!b.checkIn.simulated) - Number(!!a.checkIn.simulated) ||
      b.idx - a.idx,
  );
}
