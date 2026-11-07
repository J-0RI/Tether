import { calculateStatus, latestAnswered } from "../../calculateStatus";
import { fmtDate, parseDate } from "../../lib/dates";
import type {
  ActivityEntry,
  CheckIn,
  Patient,
  Reason,
  StatusResult,
} from "../../types";

/**
 * Status a check-in produced at the time it arrived, from patient-reported data only.
 * Readiness and surgery timing are excluded because they reflect today's checklist,
 * not what was known on that date.
 */
export function statusAtCheckIn(p: Patient, checkInId: string): StatusResult {
  const idx = p.checkIns.findIndex((c) => c.id === checkInId);
  const c = p.checkIns[idx];
  return calculateStatus(
    {
      ...p,
      checkIns: p.checkIns.slice(0, idx + 1),
      surgeryDate: null,
      readiness: [],
      resolved: [],
    },
    parseDate(c.date),
  );
}

export function historyStatuses(p: Patient): Map<string, StatusResult> {
  return new Map(p.checkIns.map((c) => [c.id, statusAtCheckIn(p, c.id)]));
}

export type ReasonSource = "patient" | "caregiver" | "readiness" | "calculated";

export const SOURCE_LABEL: Record<ReasonSource, string> = {
  patient: "Patient-reported",
  caregiver: "Caregiver-reported",
  readiness: "Readiness checklist",
  calculated: "Calculated by Tether",
};

/** Where a reason's underlying data came from, and when, so it can be shown inline. */
export function reasonSource(
  r: Reason,
  p: Patient,
): { source: ReasonSource; when: string | null } {
  if (r.code.startsWith("readiness:")) {
    return {
      source: "readiness",
      when: p.surgeryDate ? `surgery ${fmtDate(p.surgeryDate, { year: false })}` : null,
    };
  }
  if (r.code === "no-reply") {
    const last = latestAnswered(p);
    return {
      source: "calculated",
      when: last ? `last reply ${fmtDate(last.date, { year: false })}` : null,
    };
  }
  const last = latestAnswered(p);
  return {
    source: last?.channel === "caregiver" ? "caregiver" : "patient",
    when: last ? fmtDate(last.date, { year: false }) : null,
  };
}

export function respondentLabel(c: CheckIn, p: Patient): string {
  if (c.channel === "caregiver" && p.caregiver) {
    return `${p.caregiver.name} (${p.caregiver.relationship.toLowerCase()}) for ${p.firstName}`;
  }
  if (c.channel === "phone") return `${p.firstName} · keypad`;
  return p.firstName;
}

/** Most recent care-team review of the latest check-in, if any. */
export function latestReview(p: Patient): ActivityEntry | undefined {
  const latestId = p.checkIns.at(-1)?.id;
  return [...p.activity]
    .reverse()
    .find((a) => a.kind === "review" && a.checkInId === latestId);
}

export const ACTIVITY_LABEL: Record<ActivityEntry["kind"], string> = {
  followup: "Follow-up",
  review: "Flag review",
  video: "Video invitation",
  call: "Call scheduled",
  refer: "Referral",
  resolved: "Resolved",
  note: "Clinical note",
  checkin: "Check-in received",
  system: "System",
};

export function isCareTeamEntry(a: ActivityEntry): boolean {
  return a.kind !== "checkin" && a.kind !== "system";
}
