import { AlertOctagon, ChevronLeft, ChevronRight, History, NotebookPen } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { fmtDate, fmtTimestamp } from "../../lib/dates";
import { CHANNEL_LABEL } from "../../lib/questions";
import { safetyResponse } from "../../lib/safety";
import type { ActivityEntry, CheckIn, Patient, StatusResult } from "../../types";
import type { ActionHandlers } from "../ActionsPanel";
import { Button, Field, SegmentedControl } from "../ui";
import { STATUS_META, inputCls } from "../uiStyles";
import { CheckInTranscript } from "./CheckInTranscript";
import { MetricPanels } from "./MetricPanels";
import { ACTIVITY_LABEL, isCareTeamEntry, respondentLabel } from "./clinical";

export function ClinicalReview({
  patient: p,
  result,
  statuses,
  selectedId,
  onSelect,
  handlers,
  composeRequest,
}: {
  patient: Patient;
  result: StatusResult;
  statuses: Map<string, StatusResult>;
  selectedId: string;
  onSelect: (id: string) => void;
  handlers: ActionHandlers;
  /** Incremented by the toolbar's "Add note" to open the note composer */
  composeRequest: number;
}) {
  const idx = p.checkIns.findIndex((c) => c.id === selectedId);
  const c = p.checkIns[idx];
  const isLatest = idx === p.checkIns.length - 1;
  const atTime = statuses.get(c.id);

  return (
    <section aria-labelledby="pw-review-title">
      <RecordHeader
        c={c}
        p={p}
        isLatest={isLatest}
        onPrev={idx > 0 ? () => onSelect(p.checkIns[idx - 1].id) : undefined}
        onNext={!isLatest ? () => onSelect(p.checkIns[idx + 1].id) : undefined}
        onLatest={() => onSelect(p.checkIns.at(-1)!.id)}
        atTime={atTime}
        current={result}
      />

      <div className="pw-section">
        <MetricPanels p={p} c={c} selectedId={selectedId} onSelect={onSelect} />
      </div>

      <div className="pw-section">
        <CheckInTranscript key={c.id} p={p} c={c} />
      </div>

      <div id="pw-notes" tabIndex={-1} className="pw-section pw-anchor">
        <Documentation p={p} handlers={handlers} composeRequest={composeRequest} />
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function RecordHeader({
  c,
  p,
  isLatest,
  onPrev,
  onNext,
  onLatest,
  atTime,
  current,
}: {
  c: CheckIn;
  p: Patient;
  isLatest: boolean;
  onPrev?: () => void;
  onNext?: () => void;
  onLatest: () => void;
  atTime?: StatusResult;
  current: StatusResult;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="pw-eyebrow">{isLatest ? "Latest check-in" : "Historical check-in"}</div>
          <h2 id="pw-review-title" className="mt-0.5 text-[19px] font-semibold tracking-[-0.02em]">
            <span className="tabular">{fmtDate(c.date)}</span>
            <span className="font-normal text-muted"> · {c.time}</span>
          </h2>
          <p className="mt-0.5 text-[13px] text-ink-secondary">
            {CHANNEL_LABEL[c.channel]} · {respondentLabel(c, p)} ·{" "}
            <span className={c.missed ? "font-semibold text-watch" : ""}>
              {c.missed ? "No response" : "Completed"}
            </span>
            {c.simulated ? <span className="text-select"> · Simulated in demo</span> : null}
          </p>
        </div>

        <div className="flex items-center gap-1" role="group" aria-label="Step through check-ins">
          <button
            type="button"
            onClick={onPrev}
            disabled={!onPrev}
            aria-label="Previous (older) check-in"
            className="grid size-8 place-items-center rounded-full border border-line text-ink-secondary hover:bg-hover disabled:opacity-35"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={!onNext}
            aria-label="Next (newer) check-in"
            className="grid size-8 place-items-center rounded-full border border-line text-ink-secondary hover:bg-hover disabled:opacity-35"
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {!isLatest ? (
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 bg-select-tonal/60 px-3 py-2 text-[12.5px] text-select-ink">
          <span className="inline-flex items-center gap-1.5">
            <History className="size-4 shrink-0" aria-hidden="true" />
            <span>
              Viewing a past record. Reported status then:{" "}
              <b>{c.missed ? "No reply" : STATUS_META[atTime?.status ?? "ok"].label}</b>. Current status:{" "}
              <b>{STATUS_META[current.status].label}</b>.
            </span>
          </span>
          <button type="button" onClick={onLatest} className="font-semibold underline-offset-2 hover:underline">
            Return to latest
          </button>
        </div>
      ) : null}

      {c.redFlag ? (
        <div role="note" className="mt-2.5 border border-act-line bg-act-bg px-3 py-2.5 text-[13px] text-act">
          <div className="flex items-center gap-1.5 font-semibold">
            <AlertOctagon className="size-4 shrink-0" aria-hidden="true" />
            Red-flag symptom reported: {c.redFlag}
          </div>
          <p className="mt-1 text-ink">
            Safety guidance sent automatically: <b className="font-semibold">“{safetyResponse(c.redFlag)}”</b>
          </p>
          {c.followUp ? <p className="mt-1 text-ink-secondary">Care-team follow-up: {c.followUp}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */

type DocFilter = "team" | "all";

function Documentation({
  p,
  handlers,
  composeRequest,
}: {
  p: Patient;
  handlers: ActionHandlers;
  composeRequest: number;
}) {
  const [filter, setFilter] = useState<DocFilter>("team");
  const [showAll, setShowAll] = useState(false);
  const [composing, setComposing] = useState(false);
  const [note, setNote] = useState("");
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const focusPending = useRef(false);

  useEffect(() => {
    if (composeRequest === 0) return;
    focusPending.current = true;
    setComposing(true);
  }, [composeRequest]);

  // Focus once the composer has actually rendered (it may have been closed when requested)
  useEffect(() => {
    if (composing && focusPending.current) {
      focusPending.current = false;
      noteRef.current?.focus({ preventScroll: true });
    }
  });

  const entries = [...p.activity].reverse().filter((a) => filter === "all" || isCareTeamEntry(a));
  const visible = showAll ? entries : entries.slice(0, 5);

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="pw-region-title">Care-team documentation</h3>
        <div className="flex items-center gap-2">
          <SegmentedControl<DocFilter>
            label="Documentation filter"
            value={filter}
            onChange={setFilter}
            options={[
              { id: "team", label: "Care team", count: p.activity.filter(isCareTeamEntry).length },
              { id: "all", label: "All events", count: p.activity.length },
            ]}
          />
          <Button variant="secondary" size="sm" aria-expanded={composing} onClick={() => setComposing((v) => !v)}>
            <NotebookPen className="size-3.5 text-brand" aria-hidden="true" />
            Add note
          </Button>
        </div>
      </div>

      {composing ? (
        <div className="anim-enter mb-3 border border-line-strong p-3">
          <Field label="Clinical note" hint="Saved in this demo session only. A note does not clear active flags.">
            <textarea
              ref={noteRef}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder={`Document an assessment or outreach for ${p.firstName}…`}
              className={`${inputCls} resize-y`}
            />
          </Field>
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => (setComposing(false), setNote(""))}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!note.trim()}
              onClick={() => {
                handlers.saveNote(note.trim());
                setNote("");
                setComposing(false);
              }}
            >
              Save note
            </Button>
          </div>
        </div>
      ) : null}

      {entries.length === 0 ? (
        <p className="border-y border-line py-3 text-[13px] text-muted">
          No care-team interventions documented yet. Use <b>Record follow-up</b> or <b>Add note</b>.
        </p>
      ) : (
        <ol role="list" className="divide-y divide-line border-y border-line">
          {visible.map((a) => (
            <DocEntry key={a.id} a={a} />
          ))}
        </ol>
      )}

      {entries.length > 5 ? (
        <button
          type="button"
          aria-expanded={showAll}
          onClick={() => setShowAll((v) => !v)}
          className="mt-1.5 text-[12.5px] font-semibold text-brand hover:underline"
        >
          {showAll ? "Show recent 5" : `Show all ${entries.length} entries`}
        </button>
      ) : null}
    </div>
  );
}

function DocEntry({ a }: { a: ActivityEntry }) {
  const team = isCareTeamEntry(a);
  const tone =
    a.kind === "resolved"
      ? "bg-ok-bg text-ok"
      : a.kind === "followup" || a.kind === "review"
        ? "bg-brand-tonal text-brand-ink"
        : team
          ? "bg-track text-ink-secondary"
          : "bg-white text-muted ring-1 ring-line";
  return (
    <li className="anim-enter grid grid-cols-[96px_minmax(0,1fr)] gap-x-3 py-2 sm:grid-cols-[112px_minmax(0,1fr)]">
      <div className="tabular pt-px text-[12px] text-muted">{fmtTimestamp(a.at)}</div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className={`rounded-full px-2 py-px text-[11px] font-semibold ${tone}`}>{ACTIVITY_LABEL[a.kind]}</span>
          <span className="text-[12px] text-muted">{team ? a.by : "Tether automated"}</span>
        </div>
        <p className={`mt-0.5 text-[13px] ${team ? "text-ink" : "text-ink-secondary"}`}>{a.text}</p>
      </div>
    </li>
  );
}
