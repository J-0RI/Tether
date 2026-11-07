// Rebuilds the automated Tether check-in conversation for one check-in from its stored answers.
// The wording follows the Tether check-in script; every reply is derived from recorded data,
// never invented.
import { calculateStatus } from "../../calculateStatus";
import { daysAgo, daysUntil, fmtDate, parseDate } from "../../lib/dates";
import { safetyResponse } from "../../lib/safety";
import type { CheckIn, Mood, Patient, ReadinessKey, Status } from "../../types";

/** Fictional demo clinic line used in all closing messages. */
export const CLINIC_NUMBER = "(306) 555-0100";

export type Outcome = Status | "red" | "noreply";

export interface Turn {
  from: "tether" | "reply" | "event";
  text: string;
  /** What a coded or free-text reply was recorded as */
  meaning?: string;
  /** Reply that met a flag rule, or a safety message */
  tone?: "flag" | "alert";
}

/** A question with its reply (and any branch), kept together for previewing. */
export interface Exchange {
  turns: Turn[];
  important: boolean;
  /** Opening and closing always show in the preview */
  pinned?: boolean;
}

export interface Transcript {
  exchanges: Exchange[];
  outcome: Outcome;
  monthly: boolean;
  readiness: boolean;
  typeLabel: string;
  respondent: string;
}

const MOOD_SCALE: Record<Mood, string> = {
  Good: "0 — Not at all",
  Okay: "1 — Some days",
  Low: "2 — More than half the days",
};

function bodyPart(p: Patient): string | null {
  if (p.procedureType === "Knee replacement") return "knee";
  if (p.procedureType === "Hip replacement") return "hip";
  return null;
}

function surgeryWord(p: Patient): string {
  const part = bodyPart(p);
  if (part) return part;
  return p.procedureType === "Cataract surgery" ? "cataract" : "hernia";
}

/** The first check-in of each calendar month carries the monthly questions. */
export function isMonthly(p: Patient, c: CheckIn): boolean {
  if (c.answers && !c.answers.wants) return true; // the preference question was asked
  const month = c.date.slice(0, 7);
  return p.checkIns.find((x) => x.date.slice(0, 7) === month)?.id === c.id;
}

function daysBeforeSurgery(p: Patient, c: CheckIn): number | null {
  if (!p.surgeryDate) return null;
  const d = daysUntil(p.surgeryDate, parseDate(c.date));
  return d >= 0 ? d : null;
}

export function isReadiness(p: Patient, c: CheckIn): boolean {
  const d = daysBeforeSurgery(p, c);
  return d !== null && d <= 42;
}

/** Classification the check-in produced when it was sent, which picks the closing message. */
function outcomeAt(p: Patient, c: CheckIn): Outcome {
  if (c.missed || !c.answers) return "noreply";
  if (c.redFlag) return "red";
  const idx = p.checkIns.findIndex((x) => x.id === c.id);
  // Items confirmed after this check-in were still missing when it was sent
  const readiness = p.readiness.map((r) =>
    r.state === "done" && r.date && r.date > c.date ? { ...r, state: "missing" as const } : r,
  );
  return calculateStatus(
    { ...p, readiness, checkIns: p.checkIns.slice(0, idx + 1), resolved: [] },
    parseDate(c.date),
  ).status;
}

/** Readiness answer as of the check-in date: confirmed only if confirmed by then. */
function readyAt(p: Patient, key: ReadinessKey, c: CheckIn): boolean | null {
  const r = p.readiness.find((x) => x.key === key);
  if (!r || r.state === "na" || r.state === "notdue") return null;
  if (r.state === "missing") return false;
  return !r.date || r.date <= c.date;
}

/** Automated calls speak the same script with keypad instructions instead of reply formats. */
function spoken(text: string, p: Patient): string {
  return text
    .replace(/^Hi (\w+), it's Tether, (your|the) check-in for (.+?)\. 6 quick questions, about 2 minutes\. Reply STOP anytime\.$/, (_m, n, _w, rest) => `Hello ${n}, this is Tether calling with ${p.firstName === n ? "your" : "the"} check-in for ${rest}. 6 quick questions, about 2 minutes. Answer using your keypad.`)
    .replace("Reminder: your Tether check-in is still open. Reply anytime, or call", "We will call again tomorrow. To reach the care team sooner, call")
    .replace(/ 1 Better, 2 Same, 3 Worse\?$/, " better, the same, or worse? Press 1 for better, 2 for the same, 3 for worse.")
    .replace(/, 0–10\?$/, ". Enter 0 to 10 on your keypad.")
    .replace(/ \(0–7\)$/, " Enter 0 to 7.")
    .replace(/ 0 Not at all, 1 Some days, 2 More than half the days, 3 Nearly every day$/, " Press 0 for not at all, 1 for some days, 2 for more than half the days, 3 for nearly every day.")
    .replace(/ Yes \/ No \/ Not sure$/, " Press 1 for yes, 2 for no, 3 if you're not sure.")
    .replace(/ Y\/N$/, " Press 1 for yes, 2 for no.")
    .replace(/\? 1 Surgery info, 2 Exercises, 3 Pain or medication, 4 Travel or ride, 5 Something else$/, "? Press 1 for surgery information, 2 for exercises, 3 for pain or medication, 4 for travel or a ride, 5 for something else.");
}

export function buildTranscript(p: Patient, c: CheckIn): Transcript {
  const t = buildTextTranscript(p, c);
  if (c.channel !== "phone") return t;
  const KEY: Record<string, string> = { Y: "1", N: "2", Yes: "1", No: "2", "Not sure": "3" };
  for (const e of t.exchanges)
    for (const turn of e.turns) {
      if (turn.from === "tether") turn.text = spoken(turn.text, p);
      else if (turn.from === "reply" && KEY[turn.text]) turn.text = KEY[turn.text];
    }
  return t;
}

function buildTextTranscript(p: Patient, c: CheckIn): Transcript {
  const cg = c.channel === "caregiver" ? p.caregiver : undefined;
  const who = cg ? cg.name.split(" ")[0] : p.firstName;
  const subj = cg ? `${p.firstName}'s` : "your";
  const part = bodyPart(p);
  const yn = (v: boolean) => (v ? "Y" : "N");
  const monthly = !c.missed && isMonthly(p, c);
  const readiness = !c.missed && isReadiness(p, c);
  const outcome = outcomeAt(p, c);
  const ex: Exchange[] = [];
  const q = (text: string, reply: string, opts: Partial<Turn> & { important?: boolean } = {}) => {
    const { important, ...rest } = opts;
    ex.push({
      turns: [
        { from: "tether", text },
        { from: "reply", text: reply, ...rest },
      ],
      important: !!important || !!rest.tone,
    });
  };

  ex.push({
    pinned: true,
    important: true,
    turns: [
      {
        from: "tether",
        text: cg
          ? `Hi ${who}, it's Tether, the check-in for ${p.firstName}'s ${surgeryWord(p)} surgery wait. 6 quick questions, about 2 minutes. Reply STOP anytime.`
          : `Hi ${who}, it's Tether, your check-in for your ${surgeryWord(p)} surgery wait. 6 quick questions, about 2 minutes. Reply STOP anytime.`,
      },
    ],
  });

  const typeLabel = c.missed
    ? "Core check-in"
    : monthly && readiness
      ? "Monthly + readiness check-in"
      : monthly
        ? "Monthly check-in"
        : readiness
          ? "Readiness check-in"
          : "Core check-in";
  const respondent = cg ? `Caregiver (${cg.name}, ${cg.relationship.toLowerCase()})` : "Patient";

  if (c.missed || !c.answers) {
    ex.push({
      important: true,
      turns: [
        { from: "event", text: "No reply received" },
        {
          from: "tether",
          text: `Reminder: your Tether check-in is still open. Reply anytime, or call ${CLINIC_NUMBER}.`,
        },
        { from: "event", text: "No reply received after the 24-hour reminder" },
      ],
    });
    return { exchanges: ex, outcome, monthly: false, readiness: false, typeLabel, respondent };
  }

  const a = c.answers;

  // ---- Core questions, every 2 weeks ----
  q(
    cg
      ? `Compared with 2 weeks ago, is ${subj} health 1 Better, 2 Same, 3 Worse?`
      : "Compared with 2 weeks ago, is your health 1 Better, 2 Same, 3 Worse?",
    a.worse ? "3" : "2",
    { meaning: a.worse ? "Worse" : "Same", tone: a.worse ? "flag" : undefined },
  );

  const painUp = a.pain - p.baseline.pain;
  q(
    part ? `Pain in ${subj} ${part} today, 0–10?` : `${cg ? `${p.firstName}'s pain` : "Pain"} today, 0–10?`,
    c.raw?.pain ?? String(a.pain),
    {
      meaning: `${a.pain}/10${painUp >= 2 ? ` · baseline ${p.baseline.pain}` : ""}`,
      tone: painUp >= 2 ? "flag" : undefined,
    },
  );

  const walkDown = p.baseline.walk - a.walk;
  q(
    cg
      ? `How many days this week did ${p.firstName} walk or exercise for 15+ minutes? (0–7)`
      : "How many days this week did you walk or exercise for 15+ minutes? (0–7)",
    c.raw?.walk ?? String(a.walk),
    {
      meaning: `${a.walk} ${a.walk === 1 ? "day" : "days"}${walkDown >= 3 ? ` · baseline ${p.baseline.walk}` : ""}`,
      tone: walkDown >= 3 ? "flag" : undefined,
    },
  );

  q(
    cg
      ? `Over the last 2 weeks, how often has ${p.firstName} felt down or lost interest in things? 0 Not at all, 1 Some days, 2 More than half the days, 3 Nearly every day`
      : "Over the last 2 weeks, how often have you felt down or lost interest in things? 0 Not at all, 1 Some days, 2 More than half the days, 3 Nearly every day",
    MOOD_SCALE[a.mood].split(" — ")[0],
    { meaning: MOOD_SCALE[a.mood].split(" — ")[1], tone: a.mood === "Low" ? "flag" : undefined },
  );

  q(
    "Any of these new: fever, wound or infection, chest pain, shortness of breath, a fall? Y/N",
    yn(!!c.redFlag),
    c.redFlag ? { meaning: `Yes · ${c.redFlag}`, tone: "alert" } : { meaning: "No" },
  );

  // A red flag ends the check-in immediately.
  if (c.redFlag) {
    if (c.note) ex[ex.length - 1].turns.push({ from: "reply", text: c.note });
    ex.push({
      pinned: true,
      important: true,
      turns: [
        {
          from: "tether",
          tone: "alert",
          text: /chest|breath/i.test(c.redFlag)
            ? `${safetyResponse(c.redFlag)} Your care team has also been notified.`
            : "Please call HealthLine 811 now or go to emergency. Your care team has also been notified.",
        },
      ],
    });
    return { exchanges: ex, outcome, monthly: false, readiness: false, typeLabel, respondent };
  }

  // Missing surgery information is answered through the help branch ("1 Surgery info").
  const needsHelp = a.help || !a.info;
  const helpTurns: Turn[] = [
    { from: "tether", text: cg ? `Does ${p.firstName} need help with anything? Y/N` : "Do you need help with anything? Y/N" },
    { from: "reply", text: c.raw?.help ?? yn(needsHelp), meaning: needsHelp ? "Yes" : "No", tone: needsHelp ? "flag" : undefined },
  ];
  if (needsHelp) {
    const ride =
      /ride|drive|driv/i.test(c.note ?? "") || p.readiness.find((r) => r.key === "ride")?.state === "missing";
    const [code, label] = !a.info ? ["1", "Surgery info"] : ride ? ["4", "Travel or ride"] : ["5", "Something else"];
    helpTurns.push(
      {
        from: "tether",
        text: "What do you need help with? 1 Surgery info, 2 Exercises, 3 Pain or medication, 4 Travel or ride, 5 Something else",
      },
      { from: "reply", text: code, meaning: label, tone: "flag" },
    );
  }
  if (c.note) helpTurns.push({ from: "reply", text: c.note });
  ex.push({ turns: helpTurns, important: needsHelp || !!c.note });

  // ---- Monthly add-on ----
  if (monthly) {
    q(
      cg ? `Does ${p.firstName} still want this surgery? Yes / No / Not sure` : "Do you still want this surgery? Yes / No / Not sure",
      c.raw?.wants ?? (a.wants ? "Yes" : "No"),
      { meaning: a.wants ? "Yes" : "No", tone: a.wants ? undefined : "alert" },
    );
  }

  // ---- Readiness, from about 6 weeks before a booked surgery ----
  const before = daysBeforeSurgery(p, c);
  if (readiness && before !== null) {
    const items: [ReadinessKey, string][] = [
      ["bloodwork", "Bloodwork done? Y/N"],
      ["anesthesia", "Anesthesia appointment booked? Y/N"],
      ["ride", "Ride home arranged? Y/N"],
      ["homeHelp", "Someone to stay with you for 24 hours after surgery? Y/N"],
    ];
    if (p.distanceKm > 100) items.push(["travel", "Accommodation arranged, since you live far from the hospital? Y/N"]);
    if (before === 3) {
      items.push(["fasting", "Do you understand your fasting and medication instructions, including any blood thinners? Y/N"]);
    }
    for (const [key, text] of items) {
      const v = readyAt(p, key, c);
      if (v === null) continue;
      q(text, yn(v), { meaning: v ? "Yes" : "No", tone: v ? undefined : "flag" });
    }
    if (before === 1) {
      q("Feeling well, no cold or fever? Y/N", "Y", { meaning: "Yes" });
      q("Still coming tomorrow? Y/N", yn(a.wants), { meaning: a.wants ? "Yes" : "No", tone: a.wants ? undefined : "alert" });
    }
  }

  // ---- Closing ----
  const next = fmtDate(daysAgo(-14, parseDate(c.date)), { year: false });
  const closing =
    outcome === "act"
      ? `Thanks, ${who}. A nurse will call you within 1 business day to sort this out before ${cg ? `${p.firstName}'s` : "your"} surgery. Questions before then? Call ${CLINIC_NUMBER}.`
      : outcome === "watch"
        ? `Thanks, ${who}. ${cg ? `${p.firstName}'s` : "Your"} care team has your answers. A nurse will contact you within 2 business days to follow up, by video or phone. Questions before then? Call ${CLINIC_NUMBER}.`
        : `Thanks, ${who}. Your answers have been sent to ${cg ? `${p.firstName}'s` : "your"} care team. A nurse may send you a link for a short video check-in in the next few weeks. Your next check-in is ${next}. Questions before then? Call ${CLINIC_NUMBER}.`;
  ex.push({ pinned: true, important: true, turns: [{ from: "tether", text: closing }] });

  return { exchanges: ex, outcome, monthly, readiness, typeLabel, respondent };
}

/** Exchanges for the collapsed preview: opening, the most informative exchanges, closing. */
export function previewIndices(t: Transcript, max = 4): Set<number> {
  const keep = new Set<number>();
  t.exchanges.forEach((e, i) => e.pinned && keep.add(i));
  const middle = t.exchanges.map((e, i) => ({ e, i })).filter(({ e }) => !e.pinned);
  const important = middle.filter(({ e }) => e.important).slice(0, max);
  const picked = important.length >= 2 ? important : [...important, ...middle.filter(({ e }) => !e.important)].slice(0, Math.max(2, important.length));
  picked.forEach(({ i }) => keep.add(i));
  return keep;
}
