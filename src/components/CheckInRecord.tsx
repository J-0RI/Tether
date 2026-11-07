import {
  AlertOctagon,
  ChevronDown,
  ChevronUp,
  PhoneMissed,
} from "lucide-react";
import { useState } from "react";
import { calculateStatus } from "../calculateStatus";
import { fmtDate, parseDate } from "../lib/dates";
import {
  CHANNEL_LABEL,
  QUESTIONS,
  defaultReply,
  formatAnswer,
} from "../lib/questions";
import { safetyResponse } from "../lib/safety";
import type { Answers, CheckIn, Patient, QuestionKey } from "../types";
import { ChannelBadge, StatusPill } from "./ui";

function answerConcern(
  key: QuestionKey,
  a: Answers,
  p: Patient,
): { level: "act" | "watch"; reason: string } | null {
  switch (key) {
    case "wants":
      return a.wants
        ? null
        : { level: "act", reason: "Preference change — confirm wish" };
    case "pain":
      return a.pain - p.baseline.pain >= 2
        ? {
            level: "watch",
            reason: `+${a.pain - p.baseline.pain} vs baseline ${p.baseline.pain}/10`,
          }
        : null;
    case "walk":
      return p.baseline.walk - a.walk >= 3
        ? {
            level: "watch",
            reason: `−${p.baseline.walk - a.walk}d vs baseline ${p.baseline.walk}d/wk`,
          }
        : null;
    case "mood":
      return a.mood === "Low"
        ? { level: "watch", reason: "Low mood reported" }
        : null;
    case "worse":
      return a.worse
        ? { level: "watch", reason: "Self-reported worsening" }
        : null;
    case "info":
      return a.info ? null : { level: "watch", reason: "Missing surgery info" };
    case "help":
      return a.help
        ? { level: "watch", reason: "Assistance requested" }
        : null;
  }
}

export function CheckInDetailRecord({
  checkIn: c,
  patient: p,
}: {
  checkIn: CheckIn;
  patient: Patient;
}) {
  const caregiverLabel =
    c.channel === "caregiver" && p.caregiver
      ? `${p.caregiver.name} (${p.caregiver.relationship.toLowerCase()})`
      : null;

  const respondentLabel =
    c.channel === "caregiver" && caregiverLabel
      ? `Caregiver-facilitated · ${caregiverLabel}`
      : c.channel === "phone"
        ? `Patient via automated landline keypad (${p.phone.replace(" (landline)", "")})`
        : `Patient direct (${p.phone})`;

  if (c.missed || !c.answers) {
    return (
      <div className="border-t border-line bg-white px-3 py-2.5 text-[13px] text-ink-secondary">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted">
          <span>
            Method: <strong className="font-medium text-ink">{CHANNEL_LABEL[c.channel]}</strong>
          </span>
          <span>Respondent: {respondentLabel}</span>
          <span className="font-semibold text-watch">Status: Unanswered</span>
        </div>
        <p className="mt-1.5 text-[13px] text-ink-secondary">
          Automated check-in and follow-up reminder simulated; no patient
          response was recorded for this interval.
        </p>
      </div>
    );
  }

  return (
    <div className="border-t border-line bg-white pt-2.5 pb-3">
      <div className="mb-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted">
        <span>
          Method:{" "}
          <strong className="font-medium text-ink">
            {CHANNEL_LABEL[c.channel]}
          </strong>
        </span>
        <span>Respondent: {respondentLabel}</span>
        <span>Status: Completed (fictional simulation)</span>
      </div>

      {c.redFlag ? (
        <div
          role="note"
          className="mb-3 rounded-lg border border-act-line bg-act-bg px-3 py-2 text-[13px] text-act"
        >
          <div className="flex items-center gap-1.5 font-semibold">
            <AlertOctagon className="size-4 shrink-0" aria-hidden="true" />
            <span>Red-flag symptom reported: {c.redFlag}</span>
          </div>
          <p className="mt-1 text-[12.5px] text-ink">
            Simulated safety instruction delivered:{" "}
            <strong className="font-semibold">
              “{safetyResponse(c.redFlag)}”
            </strong>
          </p>
          {c.followUp ? (
            <p className="mt-1 text-[12.5px] text-ink-secondary">
              Care-team follow-up: {c.followUp}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="clinical-table-wrap">
        <table className="clinical-table">
          <caption className="visually-hidden">
            Check-in questions and recorded responses for {p.name} on{" "}
            {fmtDate(c.date)}
          </caption>
          <thead>
            <tr>
              <th scope="col">Check-in question</th>
              <th scope="col">Recorded answer</th>
              <th scope="col">
                {c.channel === "phone"
                  ? "Automated call keypad entry"
                  : "Verbatim detail"}
              </th>
              <th scope="col">Signal</th>
            </tr>
          </thead>
          <tbody>
            {QUESTIONS.map((q) => {
              const flag = answerConcern(q.key, c.answers!, p);
              const raw = c.raw?.[q.key];
              const detailText =
                c.channel === "phone"
                  ? defaultReply(q.key, c.answers!, "phone")
                  : raw
                    ? `“${raw}”`
                    : "—";

              return (
                <tr key={q.key}>
                  <td className="text-[13px] text-ink-secondary">
                    {c.channel === "caregiver"
                      ? q.caregiverText(p.firstName)
                      : q.text}
                  </td>
                  <td className="whitespace-nowrap font-semibold text-ink">
                    {formatAnswer(q.key, c.answers!)}
                  </td>
                  <td className="text-[12.5px] text-muted">{detailText}</td>
                  <td className="whitespace-nowrap">
                    {flag ? (
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${
                          flag.level === "act"
                            ? "bg-act-bg text-act"
                            : "bg-watch-bg text-watch"
                        }`}
                      >
                        <span
                          className={`size-1.5 rounded-full ${
                            flag.level === "act"
                              ? "bg-act-fill"
                              : "bg-watch-fill"
                          }`}
                          aria-hidden="true"
                        />
                        {flag.reason}
                      </span>
                    ) : (
                      <span className="text-[12px] text-muted">Routine</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {c.note ? (
        <div className="mt-2.5 border-l-2 border-brand pl-3 text-[13px]">
          <span className="text-[11.5px] font-semibold text-muted">
            {c.channel === "caregiver" && p.caregiver
              ? `Additional statement from ${p.caregiver.name} (${p.caregiver.relationship.toLowerCase()})`
              : `Additional statement from ${p.firstName}`}
            :{" "}
          </span>
          <span className="text-ink">“{c.note}”</span>
        </div>
      ) : null}

      {c.followUp && !c.redFlag ? (
        <p className="mt-2 text-[12.5px] text-ink-secondary">
          <strong className="font-semibold text-ink">Recorded follow-up:</strong>{" "}
          {c.followUp}
        </p>
      ) : null}
    </div>
  );
}

export function CheckInHistorySection({
  patient: p,
  freshIds,
}: {
  patient: Patient;
  freshIds: Set<string>;
}) {
  const reversed = [...p.checkIns].reverse();
  const [showAll, setShowAll] = useState(false);

  // Open the newest check-in by default if it carries any clinical concern or was just simulated
  const [openIds, setOpenIds] = useState<Set<string>>(() => {
    const newest = reversed[0];
    if (!newest) return new Set();
    return new Set([newest.id]);
  });

  const toggleOpen = (id: string) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const visible = showAll ? reversed : reversed.slice(0, 3);
  const hiddenCount = Math.max(0, reversed.length - 3);

  return (
    <section aria-labelledby="patient-checkins-heading">
      <div className="mb-2.5 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 id="patient-checkins-heading">Check-in &amp; response history</h2>
          <p className="mt-0.5 text-[12.5px] text-muted">
            Structured record of automated check-in questions, answers, and
            safety responses ({p.checkIns.length} recorded).
          </p>
        </div>

        {hiddenCount > 0 ? (
          <button
            type="button"
            aria-expanded={showAll}
            onClick={() => setShowAll((v) => !v)}
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-track px-3 py-1 text-[12px] font-semibold text-ink-secondary hover:bg-select-tonal hover:text-select-ink"
          >
            <span>
              {showAll
                ? "Show recent 3"
                : `Expand all ${reversed.length} check-ins`}
            </span>
            {showAll ? (
              <ChevronUp className="size-3.5" aria-hidden="true" />
            ) : (
              <ChevronDown className="size-3.5" aria-hidden="true" />
            )}
          </button>
        ) : null}
      </div>

      <ol role="list" className="divide-y divide-line border-y border-line-strong">
        {visible.map((c) => {
          const idxInChron = p.checkIns.findIndex((x) => x.id === c.id);
          const pointStatus = calculateStatus(
            {
              ...p,
              checkIns: p.checkIns.slice(0, idxInChron + 1),
              surgeryDate: null,
              readiness: [],
              resolved: [],
            },
            parseDate(c.date),
          );
          const isFresh = freshIds.has(c.id);
          const isOpen = openIds.has(c.id) || isFresh;

          return (
            <li
              key={c.id}
              className={`${isFresh ? "anim-flash" : ""} bg-white`}
            >
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => toggleOpen(c.id)}
                className="flex w-full items-center justify-between gap-3 py-2.5 px-1 text-left hover:bg-hover"
              >
                <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="tabular text-[13.5px] font-semibold text-ink">
                    {fmtDate(c.date)}
                  </span>
                  <span className="text-[12px] text-muted">{c.time}</span>
                  <ChannelBadge
                    channel={c.channel}
                    detail={
                      c.channel === "caregiver" && p.caregiver
                        ? p.caregiver.name
                        : undefined
                    }
                  />
                  {c.missed ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-watch-bg px-2 py-0.5 text-[11.5px] font-semibold text-watch">
                      <PhoneMissed className="size-3" aria-hidden="true" />
                      No response
                    </span>
                  ) : (
                    <>
                      <StatusPill status={pointStatus.status} />
                      <span className="text-[12.5px] text-ink-secondary">
                        Pain <strong>{c.answers!.pain}/10</strong> · Walk{" "}
                        <strong>{c.answers!.walk}d/wk</strong> · Mood{" "}
                        <strong>{c.answers!.mood}</strong>
                        {!c.answers!.wants ? (
                          <span className="font-semibold text-act">
                            {" "}
                            · Unsure about surgery
                          </span>
                        ) : null}
                      </span>
                    </>
                  )}
                  {isFresh || c.simulated ? (
                    <span className="rounded-full bg-select-tonal px-2 py-0.5 text-[11px] font-bold text-select-ink">
                      New · simulated
                    </span>
                  ) : null}
                </div>

                <span className="inline-flex shrink-0 items-center gap-1 text-[12px] font-medium text-brand">
                  <span>{isOpen ? "Hide Q&A" : "View Q&A"}</span>
                  <ChevronDown
                    className={`size-4 transition-transform duration-150 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                    aria-hidden="true"
                  />
                </span>
              </button>

              {isOpen ? (
                <div className="px-1">
                  <CheckInDetailRecord checkIn={c} patient={p} />
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
