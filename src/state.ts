import { latestAnswered, latestCheckIn } from "./calculateStatus";
import { demoNow, fmtTime, toDateStr } from "./lib/dates";
import { NURSE, initialPatients } from "./mockData";
import type {
  ActivityEntry,
  Answers,
  CheckIn,
  Patient,
  QuestionKey,
  ReadinessKey,
  ReadinessState,
} from "./types";

export type Scenario =
  "pain-worse" | "no-ride" | "not-wanting" | "all-good" | "red-flag";

export const SCENARIOS: { id: Scenario; label: string; hint: string }[] = [
  { id: "pain-worse", label: "Pain worse", hint: "Pain 8, walking 0" },
  {
    id: "no-ride",
    label: "No ride home",
    hint: "Ride fell through, asks for help",
  },
  {
    id: "not-wanting",
    label: "Doesn't want surgery",
    hint: 'Answers "No" to still wanting it',
  },
  { id: "all-good", label: "All good", hint: "Back to baseline, mood good" },
  {
    id: "red-flag",
    label: "Red flag: fever",
    hint: "Triggers the HealthLine 811 auto-reply",
  },
];

export type Action =
  | {
      type: "simulate";
      patientId: string;
      scenario: Scenario;
      checkInId: string;
    }
  | {
      type: "log";
      patientId: string;
      kind: ActivityEntry["kind"];
      text: string;
    }
  | {
      type: "resolve";
      patientId: string;
      codes: string[];
      readinessKeys: ReadinessKey[];
      note: string;
    }
  | { type: "notes"; patientId: string; notes: string }
  | { type: "reset" };

let seq = 0;
const uid = (p: string) =>
  `${p}-${Date.now().toString(36)}-${(seq++).toString(36)}`;

function entry(kind: ActivityEntry["kind"], text: string): ActivityEntry {
  return { id: uid("act"), at: demoNow().toISOString(), kind, text, by: NURSE };
}

function setReadiness(
  p: Patient,
  key: ReadinessKey,
  state: ReadinessState,
  detail?: string,
): Patient["readiness"] {
  const today = toDateStr(demoNow());
  return p.readiness.map((r) =>
    r.key === key
      ? {
          ...r,
          state,
          date: state === "done" ? today : undefined,
          detail: detail ?? r.detail,
        }
      : r,
  );
}

function simulatedCheckIn(
  p: Patient,
  scenario: Scenario,
  id: string,
): { checkIn: CheckIn; patient: Partial<Patient> } {
  const prev = latestAnswered(p)?.answers;
  const base: Answers = {
    worse: false,
    pain: prev?.pain ?? p.baseline.pain,
    walk: prev?.walk ?? p.baseline.walk,
    mood: prev?.mood ?? p.baseline.mood,
    info: true,
    help: false,
    wants: true,
  };
  const now = demoNow();
  const typed = p.contactMethod !== "phone";
  let answers = base;
  let raw: Partial<Record<QuestionKey, string>> | undefined;
  let note: string | undefined;
  let redFlag: string | undefined;
  let patch: Partial<Patient> = {};

  switch (scenario) {
    case "pain-worse":
      answers = {
        ...base,
        worse: true,
        pain: 8,
        walk: 0,
        mood: base.mood === "Good" ? "Okay" : base.mood,
      };
      raw = typed
        ? {
            worse: "yes",
            pain: "8, really bad this week",
            walk: "0, too sore to walk",
          }
        : undefined;
      break;
    case "no-ride":
      answers = { ...base, help: true };
      raw = typed ? { help: "yes" } : undefined;
      note = typed
        ? "My ride home after surgery fell through. Can someone help?"
        : undefined;
      patch = {
        readiness: setReadiness(
          p,
          "ride",
          "missing",
          "Patient reported ride fell through",
        ),
      };
      break;
    case "not-wanting":
      answers = { ...base, wants: false };
      raw = typed ? { wants: "no" } : undefined;
      note = typed
        ? "I've been thinking about it and I'm not sure I want the surgery anymore."
        : undefined;
      patch = {
        readiness: setReadiness(
          p,
          "wants",
          "missing",
          'Said "No" on latest check-in',
        ),
      };
      break;
    case "all-good":
      answers = {
        ...base,
        pain: p.baseline.pain,
        walk: p.baseline.walk,
        mood: "Good",
      };
      raw = typed ? { mood: "good!" } : undefined;
      note = typed ? "All good, thanks for checking in." : undefined;
      if (p.readiness.find((r) => r.key === "wants")?.state === "missing") {
        patch = {
          readiness: setReadiness(p, "wants", "done", "Confirmed by check-in"),
        };
      }
      break;
    case "red-flag":
      answers = { ...base, worse: true };
      raw = typed ? { worse: "yes" } : undefined;
      note = typed ? "I have a fever since last night, 38.9" : undefined;
      redFlag = "fever";
      break;
  }

  return {
    checkIn: {
      id,
      date: toDateStr(now),
      time: fmtTime(now),
      channel: p.contactMethod,
      answers,
      raw,
      note,
      redFlag,
      simulated: true,
    },
    patient: patch,
  };
}

function updatePatient(
  state: Patient[],
  id: string,
  fn: (p: Patient) => Patient,
): Patient[] {
  return state.map((p) => (p.id === id ? fn(p) : p));
}

export function reducer(state: Patient[], action: Action): Patient[] {
  switch (action.type) {
    case "reset":
      return initialPatients();
    case "simulate":
      return updatePatient(state, action.patientId, (p) => {
        const { checkIn, patient } = simulatedCheckIn(
          p,
          action.scenario,
          action.checkInId,
        );
        const via = {
          text: "by text",
          phone: "by automated call",
          caregiver: `from caregiver ${p.caregiver?.name ?? ""}`.trim(),
        }[p.contactMethod];
        return {
          ...p,
          ...patient,
          checkIns: [...p.checkIns, checkIn],
          activity: [
            ...p.activity,
            entry("checkin", `Check-in received ${via}`),
          ],
        };
      });
    case "log":
      return updatePatient(state, action.patientId, (p) => ({
        ...p,
        activity: [
          ...p.activity,
          {
            ...entry(action.kind, action.text),
            checkInId: latestCheckIn(p)?.id,
          },
        ],
      }));
    case "resolve":
      return updatePatient(state, action.patientId, (p) => {
        const latest = latestCheckIn(p);
        let readiness = p.readiness;
        for (const key of action.readinessKeys) {
          readiness = setReadiness(
            { ...p, readiness },
            key,
            "done",
            "Confirmed by care team",
          );
        }
        const at = demoNow().toISOString();
        return {
          ...p,
          readiness,
          resolved: [
            ...p.resolved,
            ...action.codes.map((code) => ({
              code,
              checkInId: latest?.id ?? "",
              note: action.note,
              at,
            })),
          ],
          activity: [
            ...p.activity,
            entry("resolved", `Marked resolved: ${action.note}`),
          ],
        };
      });
    case "notes":
      return updatePatient(state, action.patientId, (p) => ({
        ...p,
        notes: action.notes,
        activity: [...p.activity, entry("note", `Note: ${action.notes}`)],
      }));
  }
}

export { uid };
