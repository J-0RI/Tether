import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  Clock,
  MinusCircle,
} from "lucide-react";
import { useState } from "react";
import { fmtDate, relDays } from "../lib/dates";
import { readinessBreakdown } from "../lib/derive";
import { READINESS_ITEMS } from "../lib/questions";
import type { Patient, ReadinessItem, ReadinessState } from "../types";
import type { ActionHandlers } from "./ActionsPanel";
import { Button, Field, Modal } from "./ui";
import { inputCls } from "./uiStyles";

const STATE_META: Record<
  ReadinessState,
  {
    label: string;
    icon: typeof Clock;
    iconCls: string;
    badgeCls: string;
    segCls: string;
  }
> = {
  done: {
    label: "Confirmed",
    icon: CheckCircle2,
    iconCls: "text-ok",
    badgeCls: "bg-ok-bg text-ok",
    segCls: "bg-ok-fill",
  },
  missing: {
    label: "Missing",
    icon: CircleAlert,
    iconCls: "text-act",
    badgeCls: "bg-act-bg text-act",
    segCls: "bg-act-fill",
  },
  notdue: {
    label: "Not yet due",
    icon: Clock,
    iconCls: "text-muted",
    badgeCls: "bg-track text-ink-secondary",
    segCls: "bg-line-strong",
  },
  na: {
    label: "Not applicable",
    icon: MinusCircle,
    iconCls: "text-muted",
    badgeCls: "bg-track text-muted",
    segCls: "bg-track",
  },
};

export function ReadinessChecklist({
  patient: p,
  handlers,
}: {
  patient: Patient;
  handlers?: ActionHandlers;
}) {
  const rb = readinessBreakdown(p.readiness);
  const missingItems = p.readiness.filter((r) => r.state === "missing");
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState<ReadinessItem | null>(null);
  const [note, setNote] = useState("");

  const visibleDefs = expanded
    ? READINESS_ITEMS
    : READINESS_ITEMS.filter((def) =>
        missingItems.some((m) => m.key === def.key),
      );

  return (
    <section aria-labelledby="patient-readiness-heading">
      <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 id="patient-readiness-heading">Surgery readiness</h2>
          <p className="mt-0.5 text-[12.5px] text-muted">
            <strong className="font-semibold text-ink">
              {rb.ready} of {rb.total}
            </strong>{" "}
            applicable items confirmed ·{" "}
            {p.surgeryDate
              ? `Booked ${fmtDate(p.surgeryDate)} (${relDays(p.surgeryDate)})`
              : "Surgery not yet booked"}
          </p>
        </div>

        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
          className="inline-flex items-center gap-1 rounded-full bg-track px-2.5 py-1 text-[12px] font-semibold text-ink-secondary hover:bg-select-tonal hover:text-select-ink"
        >
          <span>
            {expanded
              ? "Compact view"
              : `Checklist (${READINESS_ITEMS.length})`}
          </span>
          {expanded ? (
            <ChevronUp className="size-3.5" aria-hidden="true" />
          ) : (
            <ChevronDown className="size-3.5" aria-hidden="true" />
          )}
        </button>
      </div>

      {/* Connected M3 Expressive 9-item readiness progress bar */}
      <div className="mb-3">
        <div
          className="m3-connected-bar h-[7px] w-full"
          role="img"
          aria-label={`Readiness summary: ${rb.ready} confirmed, ${rb.missing} missing, ${rb.notDue} not yet due`}
        >
          {READINESS_ITEMS.map((def) => {
            const item = p.readiness.find((x) => x.key === def.key);
            const state = item?.state ?? "na";
            return (
              <span
                key={def.key}
                title={`${def.label}: ${STATE_META[state].label}`}
                className={`m3-connected-seg h-full flex-1 ${STATE_META[state].segCls}`}
              />
            );
          })}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[11.5px] text-muted">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <span
                className="size-2 rounded-full bg-ok-fill"
                aria-hidden="true"
              />
              {rb.ready} confirmed
            </span>
            {rb.missing > 0 ? (
              <span className="inline-flex items-center gap-1 font-semibold text-act">
                <span
                  className="size-2 rounded-full bg-act-fill"
                  aria-hidden="true"
                />
                {rb.missing} missing
              </span>
            ) : null}
            {rb.notDue > 0 ? (
              <span className="inline-flex items-center gap-1">
                <span
                  className="size-2 rounded-full bg-line-strong"
                  aria-hidden="true"
                />
                {rb.notDue} not due
              </span>
            ) : null}
          </div>
          <span>Confirm only after patient review</span>
        </div>
      </div>

      {visibleDefs.length === 0 ? (
        <div className="flex items-center justify-between gap-2 border-y border-line py-2.5 text-[13px] text-ink-secondary">
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 className="size-4 text-ok" aria-hidden="true" />
            <span>
              No missing readiness items ({rb.ready}/{rb.total} confirmed
              {rb.notDue > 0 ? `, ${rb.notDue} not yet due` : ""}).
            </span>
          </span>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="text-[12px] font-semibold text-brand hover:underline"
          >
            Inspect items
          </button>
        </div>
      ) : (
        <ul
          role="list"
          className="divide-y divide-line border-y border-line-strong"
        >
          {visibleDefs.map((def) => {
            const r = p.readiness.find((x) => x.key === def.key);
            if (!r) return null;
            const meta = STATE_META[r.state];
            const Icon = meta.icon;
            const canConfirm =
              Boolean(handlers) &&
              (r.state === "missing" || r.state === "notdue");

            return (
              <li
                key={def.key}
                className="flex items-start justify-between gap-3 py-2.5"
              >
                <div className="flex min-w-0 items-start gap-2.5">
                  <Icon
                    className={`mt-0.5 size-4 shrink-0 ${meta.iconCls}`}
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-ink">
                      {def.label}
                    </div>
                    <div className="mt-0.5 text-[12px] text-muted">
                      {r.detail ?? "No additional details recorded"}
                      {r.date && r.state === "done"
                        ? ` · ${fmtDate(r.date, { year: false })}`
                        : ""}
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2 pt-0.5">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.badgeCls}`}
                  >
                    {meta.label}
                  </span>
                  {canConfirm ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(r);
                        setNote("");
                      }}
                      aria-label={`Confirm ${def.label}`}
                      className="rounded-full border border-control-border bg-white px-2.5 py-0.5 text-[11.5px] font-semibold text-brand hover:bg-brand-tonal/50"
                    >
                      Confirm
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {selected && handlers ? (
        <Modal
          title="Confirm readiness item"
          onClose={() => setSelected(null)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setSelected(null)}>
                Cancel
              </Button>
              <Button
                disabled={note.trim().length < 3}
                onClick={() => {
                  handlers.resolve(
                    selected.key === "wants"
                      ? ["readiness:wants", "not-wanting"]
                      : [`readiness:${selected.key}`],
                    [selected.key],
                    note.trim(),
                  );
                  setSelected(null);
                }}
              >
                Record confirmation
              </Button>
            </>
          }
        >
          <div className="mb-3 rounded-lg border border-line bg-track/40 px-3 py-2">
            <div className="text-[11.5px] font-semibold text-muted">
              Checklist item
            </div>
            <div className="text-[14px] font-semibold text-ink">
              {READINESS_ITEMS.find((i) => i.key === selected.key)?.label}
            </div>
            {selected.detail ? (
              <div className="mt-0.5 text-[12px] text-muted">
                Current note: {selected.detail}
              </div>
            ) : null}
          </div>

          <Field
            label="Confirmation note (required)"
            hint="Document what was confirmed and with whom (patient or designated caregiver)."
          >
            <textarea
              data-autofocus
              className={inputCls}
              rows={3}
              placeholder="e.g. Confirmed post-op ride home with patient's sister"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>
        </Modal>
      ) : null}
    </section>
  );
}
