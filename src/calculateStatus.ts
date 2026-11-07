import { demoNow } from "./lib/dates";
import { daysSince, daysUntil } from "./lib/dates";
import { READINESS_ITEMS } from "./lib/questions";
import type { CheckIn, Patient, Reason, StatusResult } from "./types";

export function answeredCheckIns(p: Patient): CheckIn[] {
  return p.checkIns.filter((c) => !c.missed && c.answers);
}

export function latestCheckIn(p: Patient): CheckIn | undefined {
  return p.checkIns[p.checkIns.length - 1];
}

export function latestAnswered(p: Patient): CheckIn | undefined {
  const a = answeredCheckIns(p);
  return a[a.length - 1];
}

/** Days since the patient last answered, or null if they never have. */
export function daysSinceReply(p: Patient, now = demoNow()): number | null {
  const last = latestAnswered(p);
  return last ? daysSince(last.date, now) : null;
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/**
 * Scores a patient against the Tether rules.
 * Pure: the same patient and date always give the same result.
 *
 * Act now: surgery within 7 days with a readiness item missing; "No" to still wanting
 * surgery; a red-flag symptom on the latest reply.
 * Watch: pain 2+ above baseline; walking down 3+ days from baseline; mood Low twice in a
 * row; no reply for 14+ days; missing information or asked for help.
 */
export function calculateStatus(p: Patient, now = demoNow()): StatusResult {
  const reasons: Reason[] = [];
  const latest = latestCheckIn(p);
  const last = latestAnswered(p);
  const a = last?.answers;

  // ---- Act now ----
  if (p.surgeryDate) {
    const d = daysUntil(p.surgeryDate, now);
    if (d >= 0 && d <= 7) {
      const when = d === 0 ? "today" : d === 1 ? "tomorrow" : `in ${d} days`;
      for (const item of READINESS_ITEMS) {
        const r = p.readiness.find((x) => x.key === item.key);
        if (r?.state === "missing") {
          reasons.push({
            code: `readiness:${item.key}`,
            label: `Surgery ${when}: ${item.missing}`,
            level: "act",
            readinessKey: item.key,
          });
        }
      }
    }
  }
  if (a && !a.wants) {
    reasons.push({
      code: "not-wanting",
      readinessKey: "wants",
      label: "May no longer want surgery: confirm and update waitlist",
      level: "act",
    });
  }
  if (last?.redFlag) {
    reasons.push({
      code: "red-flag",
      label: `Red-flag symptom reported: ${last.redFlag}`,
      level: "act",
    });
  }

  // ---- Watch ----
  if (a) {
    const painUp = a.pain - p.baseline.pain;
    if (painUp >= 2) {
      reasons.push({
        code: "pain-up",
        label: `Pain up ${painUp} points since baseline (${p.baseline.pain} → ${a.pain})`,
        level: "watch",
      });
    }
    const walkDown = p.baseline.walk - a.walk;
    if (walkDown >= 3) {
      reasons.push({
        code: "walk-down",
        label:
          a.walk === 0
            ? `Stopped daily walks (was ${plural(p.baseline.walk, "day")}/week)`
            : `Walking down to ${plural(a.walk, "day")}/week (was ${p.baseline.walk})`,
        level: "watch",
      });
    }
    const answered = answeredCheckIns(p);
    const [prev, cur] = answered.slice(-2);
    if (prev?.answers?.mood === "Low" && cur?.answers?.mood === "Low") {
      reasons.push({
        code: "mood-low",
        label: 'Mood "Low" two check-ins in a row',
        level: "watch",
      });
    }
    if (!a.info) {
      reasons.push({
        code: "needs-info",
        label: "Missing information about their surgery",
        level: "watch",
      });
    }
    if (a.help) {
      reasons.push({
        code: "needs-help",
        label: "Asked for help or a referral",
        level: "watch",
      });
    }
  }
  const since = daysSinceReply(p, now);
  if (since === null || since >= 14) {
    const missed = [...p.checkIns].reverse().findIndex((c) => !c.missed);
    const missedCount = missed === -1 ? p.checkIns.length : missed;
    reasons.push({
      code: "no-reply",
      label:
        since === null
          ? "Has not replied to any check-in yet"
          : `No reply for ${since >= 21 ? plural(Math.round(since / 7), "week") : plural(since, "day")} (${plural(missedCount, "missed check-in")})`,
      level: "watch",
    });
  }

  // Reasons a nurse marked resolved stay hidden until a newer check-in arrives.
  const active = reasons.filter(
    (r) =>
      !p.resolved.some((x) => x.code === r.code && x.checkInId === latest?.id),
  );

  const status = active.some((r) => r.level === "act")
    ? "act"
    : active.length
      ? "watch"
      : "ok";
  return { status, reasons: active };
}

export const STATUS_RANK = { act: 0, watch: 1, ok: 2 } as const;
