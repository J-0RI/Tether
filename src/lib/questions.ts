import type { Answers, Channel, QuestionKey, ReadinessKey } from "../types";

export interface Question {
  key: QuestionKey;
  text: string;
  /** Same question for a caregiver answering on someone's behalf */
  caregiverText: (first: string) => string;
  /** Automated landline call prompt */
  callPrompt: string;
}

export const QUESTIONS: Question[] = [
  {
    key: "worse",
    text: "Is your health getting worse? (Yes/No)",
    caregiverText: (f) => `Is ${f}'s health getting worse? (Yes/No)`,
    callPrompt: "Press 1 if your health is getting worse. Press 2 if not.",
  },
  {
    key: "pain",
    text: "Pain today, 0–10?",
    caregiverText: (f) => `${f}'s pain today, 0–10?`,
    callPrompt: "Using your keypad, enter your pain today from 0 to 10.",
  },
  {
    key: "walk",
    text: "How many days did you walk 15+ minutes this week?",
    caregiverText: (f) => `How many days did ${f} walk 15+ minutes this week?`,
    callPrompt:
      "How many days did you walk 15 minutes or more this week? Enter 0 to 7.",
  },
  {
    key: "mood",
    text: "How is your mood this week? (Good / Okay / Low)",
    caregiverText: (f) => `How is ${f}'s mood this week? (Good / Okay / Low)`,
    callPrompt:
      "How is your mood this week? Press 1 for good, 2 for okay, 3 for low.",
  },
  {
    key: "info",
    text: "Do you have the information you need about your surgery? (Yes/No)",
    caregiverText: (f) =>
      `Do you and ${f} have the information you need about the surgery? (Yes/No)`,
    callPrompt:
      "Do you have the information you need about your surgery? Press 1 for yes, 2 for no.",
  },
  {
    key: "help",
    text: "Do you need help or a referral? (Yes/No)",
    caregiverText: (f) => `Does ${f} need help or a referral? (Yes/No)`,
    callPrompt: "Do you need help or a referral? Press 1 for yes, 2 for no.",
  },
  {
    key: "wants",
    text: "Do you still want this surgery? (Yes/No)",
    caregiverText: (f) => `Does ${f} still want this surgery? (Yes/No)`,
    callPrompt: "Do you still want this surgery? Press 1 for yes, 2 for no.",
  },
];

export function formatAnswer(key: QuestionKey, a: Answers): string {
  const v = a[key];
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (key === "pain") return `${v}/10`;
  if (key === "walk") return `${v} ${v === 1 ? "day" : "days"}`;
  return String(v);
}

/** What the patient typed or pressed when no raw wording was recorded. */
export function defaultReply(
  key: QuestionKey,
  a: Answers,
  channel: Channel,
): string {
  const v = a[key];
  if (channel === "phone") {
    if (typeof v === "boolean") return `Pressed ${v ? 1 : 2}`;
    if (key === "mood")
      return `Pressed ${v === "Good" ? 1 : v === "Okay" ? 2 : 3}`;
    return `Entered ${v}`;
  }
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}

export const CHANNEL_LABEL: Record<Channel, string> = {
  text: "Text",
  phone: "Phone call",
  caregiver: "Caregiver",
};

export const READINESS_ITEMS: {
  key: ReadinessKey;
  label: string;
  missing: string;
}[] = [
  {
    key: "bloodwork",
    label: "Pre-op bloodwork",
    missing: "pre-op bloodwork not done",
  },
  {
    key: "anesthesia",
    label: "Anesthesia consult",
    missing: "no anesthesia consult",
  },
  {
    key: "meds",
    label: "Medication review (e.g. blood thinners)",
    missing: "medication review not done",
  },
  {
    key: "fasting",
    label: "Fasting instructions confirmed",
    missing: "fasting instructions not confirmed",
  },
  {
    key: "ride",
    label: "Ride home confirmed",
    missing: "no ride home confirmed",
  },
  {
    key: "homeHelp",
    label: "Someone at home for the first 24 hours",
    missing: "no one at home for first 24 hours",
  },
  {
    key: "travel",
    label: "Travel and accommodation arranged",
    missing: "travel and accommodation not arranged",
  },
  {
    key: "prehab",
    label: "Prehab exercise plan started",
    missing: "prehab plan not started",
  },
  {
    key: "wants",
    label: "Still wants surgery: confirmed",
    missing: "wish to proceed not confirmed",
  },
];

export const MOOD_SCORE: Record<string, number> = { Low: 1, Okay: 2, Good: 3 };
