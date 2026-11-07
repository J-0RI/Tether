import { ChevronDown, PhoneCall } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import { fmtDate } from "../../lib/dates";
import type { CheckIn, Patient } from "../../types";
import { buildTranscript, previewIndices, type Turn } from "./transcript";

/**
 * Read-only record of the automated check-in exactly as Tether ran it: what was asked and
 * what came back. Nothing here sends or composes messages.
 */
export function CheckInTranscript({ p, c }: { p: Patient; c: CheckIn }) {
  const t = useMemo(() => buildTranscript(p, c), [p, c]);
  const [full, setFull] = useState(false);
  const shown = useMemo(() => previewIndices(t), [t]);
  const call = c.channel === "phone";
  const replyName =
    c.channel === "caregiver" && p.caregiver ? `${p.caregiver.name.split(" ")[0]} (caregiver)` : p.firstName;
  const total = t.exchanges.reduce((n, e) => n + e.turns.length, 0);
  const hidden = t.exchanges.length - shown.size;

  // Collapsed: render kept exchanges and fold each run of skipped ones into one marker
  const blocks: ({ kind: "ex"; i: number } | { kind: "gap"; count: number })[] = [];
  t.exchanges.forEach((_, i) => {
    if (full || shown.has(i)) blocks.push({ kind: "ex", i });
    else {
      const last = blocks.at(-1);
      if (last?.kind === "gap") last.count++;
      else blocks.push({ kind: "gap", count: 1 });
    }
  });

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="pw-region-title">{call ? "Automated call transcript" : "Automated check-in conversation"}</h3>
        {hidden > 0 ? (
          <button
            type="button"
            aria-expanded={full}
            onClick={() => setFull((v) => !v)}
            className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand hover:underline"
          >
            {full ? "Show preview" : `View full conversation (${total} messages)`}
            <ChevronDown className={`size-3.5 transition-transform ${full ? "rotate-180" : ""}`} aria-hidden="true" />
          </button>
        ) : null}
      </div>


      <ol
        role="list"
        aria-label={`${call ? "Call transcript" : "Text conversation"}, ${fmtDate(c.date)}${full ? "" : ", preview"}`}
        className={`mt-2.5 ${call ? "divide-y divide-line border-y border-line" : "max-w-[680px] space-y-1.5"}`}
      >
        {blocks.map((b, bi) =>
          b.kind === "gap" ? (
            <li key={`gap-${bi}`} className={call ? "py-1.5" : "py-0.5"}>
              <button
                type="button"
                onClick={() => setFull(true)}
                className="mx-auto flex items-center gap-2 rounded-full px-3 py-0.5 text-[12px] font-medium text-muted hover:bg-hover hover:text-ink"
              >
                <span className="h-px w-6 bg-line" aria-hidden="true" />
                {b.count} more {b.count === 1 ? "question" : "questions"}
                <span className="h-px w-6 bg-line" aria-hidden="true" />
              </button>
            </li>
          ) : (
            <Fragment key={b.i}>
              {t.exchanges[b.i].turns.map((turn, ti) => (
                <li key={`${b.i}-${ti}`}>
                  {call ? <CallLine turn={turn} name={replyName} /> : <Bubble turn={turn} />}
                </li>
              ))}
            </Fragment>
          ),
        )}
      </ol>
    </div>
  );
}

function Bubble({ turn }: { turn: Turn }) {
  if (turn.from === "event") {
    return (
      <div className="flex justify-center py-0.5">
        <span className="rounded-full border border-dashed border-control-border px-3 py-0.5 text-[12px] text-muted">
          {turn.text}
        </span>
      </div>
    );
  }
  if (turn.from === "tether") {
    return (
      <div className="flex justify-start">
        <div
          className={`max-w-[82%] rounded-[4px_14px_14px_14px] px-3 py-1.5 text-[13.5px] leading-snug ${
            turn.tone === "alert" ? "bg-act-bg font-semibold text-act" : "bg-track text-ink"
          }`}
        >
          {turn.text}
        </div>
      </div>
    );
  }
  const plainCode = turn.meaning && turn.text.trim().toLowerCase() !== turn.meaning.toLowerCase();
  return (
    <div className="flex justify-end">
      <div className="max-w-[78%] rounded-[14px_4px_14px_14px] bg-brand-tonal/70 px-3 py-1.5 text-right text-[13.5px] leading-snug text-brand-ink">
        <span className="font-medium">{turn.text}</span>
        {turn.meaning && plainCode ? (
          <span
            className={`block text-[12px] ${
              turn.tone === "alert" ? "font-semibold text-act" : turn.tone === "flag" ? "font-semibold text-watch" : "text-ink-secondary"
            }`}
          >
            {turn.meaning}
          </span>
        ) : turn.tone ? (
          <span className={`block text-[12px] font-semibold ${turn.tone === "alert" ? "text-act" : "text-watch"}`}>
            Flagged
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** Automated calls: spoken prompts and keypad entries, not chat bubbles. */
function CallLine({ turn, name }: { turn: Turn; name: string }) {
  if (turn.from === "event") {
    return <div className="py-1.5 pl-[104px] text-[12.5px] text-muted italic">{turn.text}</div>;
  }
  const tether = turn.from === "tether";
  return (
    <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-x-2 py-1.5 text-[13px]">
      <span className="inline-flex items-start gap-1 pt-px text-[11px] font-semibold tracking-wide text-muted uppercase">
        {tether ? <PhoneCall className="mt-px size-3" aria-hidden="true" /> : null}
        {tether ? "Tether" : `${name} · keypad`}
      </span>
      {tether ? (
        <span className={turn.tone === "alert" ? "font-semibold text-act" : "text-ink-secondary"}>{turn.text}</span>
      ) : (
        <span className="flex flex-wrap items-center gap-2">
          <kbd className="tabular min-w-6 rounded-[6px] border border-line-strong bg-white px-1.5 text-center font-sans text-[13px] font-semibold text-ink">
            {/^\d+$/.test(turn.text) ? turn.text : turn.text === "Y" ? "1" : turn.text === "N" ? "2" : turn.text}
          </kbd>
          {turn.meaning ? (
            <span className={turn.tone === "flag" ? "font-semibold text-watch" : turn.tone === "alert" ? "font-semibold text-act" : "text-ink"}>
              {turn.meaning}
            </span>
          ) : null}
        </span>
      )}
    </div>
  );
}
