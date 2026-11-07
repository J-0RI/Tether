export type Channel = "text" | "phone" | "caregiver";
export type Mood = "Good" | "Okay" | "Low";
export type Status = "act" | "watch" | "ok";

export type QuestionKey =
  "worse" | "pain" | "walk" | "mood" | "info" | "help" | "wants";

export interface Answers {
  worse: boolean;
  pain: number;
  walk: number;
  mood: Mood;
  info: boolean;
  help: boolean;
  wants: boolean;
}

export interface CheckIn {
  id: string;
  /** Local date, YYYY-MM-DD */
  date: string;
  /** Display time, e.g. "7:42 PM" */
  time: string;
  channel: Channel;
  missed?: boolean;
  answers?: Answers;
  /** Patient's (or caregiver's) own words for specific questions, as typed or spoken */
  raw?: Partial<Record<QuestionKey, string>>;
  /** Free-text message sent with the check-in */
  note?: string;
  /** Red-flag symptom picked up from the reply, e.g. "fever" */
  redFlag?: string;
  /** Follow-up recorded by the care team for this check-in */
  followUp?: string;
  simulated?: boolean;
}

export type ReadinessKey =
  | "bloodwork"
  | "anesthesia"
  | "meds"
  | "fasting"
  | "ride"
  | "homeHelp"
  | "travel"
  | "prehab"
  | "wants";

export type ReadinessState = "done" | "missing" | "notdue" | "na";

export interface ReadinessItem {
  key: ReadinessKey;
  state: ReadinessState;
  /** YYYY-MM-DD when completed */
  date?: string;
  detail?: string;
}

export interface MedicalRecord {
  diagnoses: string[];
  comorbidities: string[];
  medications: string[];
  allergies: string[];
  bmi: number;
  bloodPressure: string;
  bloodPressureDate: string;
  imaging: string;
  referringPhysician: string;
}

export interface ActivityEntry {
  id: string;
  /** Full ISO timestamp */
  at: string;
  kind:
    | "video"
    | "call"
    | "refer"
    | "resolved"
    | "note"
    | "checkin"
    | "system"
    | "review"
    | "followup";
  text: string;
  by: string;
  checkInId?: string;
}

export interface ResolvedReason {
  code: string;
  checkInId: string;
  note: string;
  at: string;
}

export interface Caregiver {
  name: string;
  relationship: string;
  phone: string;
}

export interface Patient {
  id: string;
  name: string;
  firstName: string;
  age: number;
  sex: "F" | "M";
  community: string;
  distanceKm: number;
  siteCity: "Regina" | "Saskatoon";
  procedure: string;
  procedureType:
    | "Hip replacement"
    | "Knee replacement"
    | "Cataract surgery"
    | "Hernia repair";
  site: string;
  surgeon: string;
  referralDate: string;
  surgeryDate: string | null;
  weeksWaiting: number;
  contactMethod: Channel;
  phone: string;
  caregiver?: Caregiver;
  baseline: { pain: number; walk: number; mood: Mood };
  checkIns: CheckIn[];
  readiness: ReadinessItem[];
  record: MedicalRecord;
  activity: ActivityEntry[];
  resolved: ResolvedReason[];
  notes: string;
}

export interface Reason {
  code: string;
  label: string;
  level: Exclude<Status, "ok">;
  readinessKey?: ReadinessKey;
}

export interface StatusResult {
  status: Status;
  reasons: Reason[];
}
