import { AlertOctagon } from "lucide-react";
import { useRef, useState } from "react";
import { daysSinceReply, latestAnswered } from "../../calculateStatus";
import { fmtDate } from "../../lib/dates";
import { CHANNEL_LABEL } from "../../lib/questions";
import type { Patient, Status, StatusResult } from "../../types";
import { SegmentedControl } from "../ui";
import { STATUS_META } from "../uiStyles";
import { useMedia } from "./useMedia";

type Filter = "all" | "flagged" | "missed";

export function CheckInHistory({
  patient: p,
  statuses,
  selectedId,
  onSelect,
  freshIds,
}: {
  patient: Patient;
  statuses: Map<string, StatusResult>;
  selectedId: string;
  onSelect: (id: string) => void;
  freshIds: Set<string>;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  // Single-column (phone) layout shows the three newest entries until expanded
  const narrow = useMedia("(max-width: 767px)");
  const [expanded, setExpanded] = useState(false);
  const listRef = useRef<HTMLOListElement>(null);
  const newestFirst = [...p.checkIns].reverse();
  const missedCount = p.checkIns.filter((c) => c.missed).length;
  const flaggedCount = p.checkIns.filter(
    (c) => !c.missed && statuses.get(c.id)?.status !== "ok",
  ).length;

  const filtered = newestFirst.filter((c) =>
    filter === "missed"
      ? c.missed
      : filter === "flagged"
        ? !c.missed && statuses.get(c.id)?.status !== "ok"
        : true,
  );
  const collapsed = narrow && !expanded && filtered.length > 3;
  const visible = collapsed
    ? filtered.filter((c, i) => i < 3 || c.id === selectedId)
    : filtered;

  // Arrow keys move through the record list, like a document index.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const i = visible.findIndex((c) => c.id === selectedId);
    const next = visible[i + (e.key === "ArrowDown" ? 1 : -1)];
    if (!next) return;
    e.preventDefault();
    onSelect(next.id);
    listRef.current
      ?.querySelector<HTMLButtonElement>(`[data-id="${next.id}"]`)
      ?.focus();
  };

  return (
    <section id="pw-checkins" tabIndex={-1} aria-labelledby="pw-history-title" className="pw-anchor flex h-full min-h-0 flex-col">
      <div className="mb-2.5 flex items-baseline justify-between gap-2">
        <h2 id="pw-history-title" className="pw-region-title">
          Check-in history
        </h2>
        <span className="tabular text-[12px] text-muted">
          {p.checkIns.length} recorded
          {missedCount ? ` · ${missedCount} missed` : ""}
        </span>
      </div>

      {(() => {
        const since = daysSinceReply(p);
        const last = latestAnswered(p);
        return since !== null && since >= 14 && last ? (
          <p className="-mt-1.5 mb-2 text-[12.5px] font-semibold text-watch">
            Last reply {since} days ago · {fmtDate(last.date, { year: false })}
          </p>
        ) : null;
      })()}

      <div className="mb-2">
        <SegmentedControl<Filter>
          label="Filter check-ins"
          value={filter}
          onChange={setFilter}
          options={[
            { id: "all", label: "All" },
            { id: "flagged", label: "Flagged", count: flaggedCount },
            { id: "missed", label: "Missed", count: missedCount },
          ]}
        />
      </div>

      <div className="scroll-panel -mx-1.5 min-h-0 flex-1 px-1.5 pb-2">
        {visible.length === 0 ? (
          <p className="px-2 py-6 text-center text-[13px] text-muted">
            No {filter === "missed" ? "missed" : "flagged"} check-ins for{" "}
            {p.firstName}.
          </p>
        ) : (
          <ol
            ref={listRef}
            role="list"
            aria-label="Check-ins, newest first"
            className="pw-timeline space-y-0.5"
            onKeyDown={onKeyDown}
          >
            {visible.map((c, idx) => {
              const st = statuses.get(c.id);
              const status: Status | "missed" = c.missed
                ? "missed"
                : (st?.status ?? "ok");
              const prev = newestFirst[newestFirst.indexOf(c) + 1];
              const prevStatus =
                prev && !prev.missed ? statuses.get(prev.id)?.status : undefined;
              const changed =
                status !== "missed" && prevStatus !== undefined && prevStatus !== status;
              const selected = c.id === selectedId;
              const a = c.answers;
              const isLatest = c.id === p.checkIns.at(-1)?.id;
              const routine = status === "ok" && !selected;

              return (
                <li key={c.id} className={freshIds.has(c.id) ? "anim-flash rounded-[14px]" : ""}>
                  <button
                    type="button"
                    data-id={c.id}
                    aria-current={selected ? "true" : undefined}
                    tabIndex={selected || (idx === 0 && !visible.some((v) => v.id === selectedId)) ? 0 : -1}
                    onClick={() => onSelect(c.id)}
                    className="pw-history-item"
                  >
                    <span className="pw-marker" aria-hidden="true">
                      <span className={`pw-shape-${status}`} />
                    </span>

                    <span className="min-w-0">
                      <span className="flex items-baseline justify-between gap-2">
                        <span
                          className={`tabular text-[13.5px] ${
                            routine ? "font-medium text-ink-secondary" : "font-semibold text-ink"
                          } ${selected ? "text-select-ink" : ""}`}
                        >
                          {fmtDate(c.date)}
                        </span>
                        {status === "missed" ? (
                          <span className="text-[11.5px] font-semibold text-muted">No reply</span>
                        ) : (
                          <span
                            className={`text-[11.5px] font-semibold ${
                              status === "act" ? "text-act" : status === "watch" ? "text-watch" : "text-ok"
                            }`}
                          >
                            {STATUS_META[status].label}
                          </span>
                        )}
                      </span>

                      <span className="mt-0.5 block text-[12px] text-muted">
                        {CHANNEL_LABEL[c.channel]}
                        {c.channel === "caregiver" && p.caregiver
                          ? ` (${p.caregiver.name.split(" ")[0]})`
                          : ""}{" "}
                        · {c.missed ? "Unanswered" : "Completed"}
                        {isLatest ? " · Latest" : ""}
                      </span>

                      {a ? (
                        <span className="tabular mt-0.5 block text-[12.5px] text-ink-secondary">
                          Pain <b className="font-semibold text-ink">{a.pain}</b> · Walk{" "}
                          <b className="font-semibold text-ink">{a.walk}d</b> · {a.mood}
                          {!a.wants ? (
                            <span className="font-semibold text-act"> · Unsure about surgery</span>
                          ) : null}
                        </span>
                      ) : null}

                      {c.redFlag ? (
                        <span className="mt-1 inline-flex items-center gap-1 text-[12px] font-semibold text-act">
                          <AlertOctagon className="size-3.5" aria-hidden="true" />
                          Red flag: {c.redFlag}
                        </span>
                      ) : null}

                      {changed || c.simulated ? (
                        <span className="mt-1 flex flex-wrap gap-1">
                          {changed ? (
                            <span className="rounded-full bg-track px-2 py-px text-[11px] font-semibold text-ink-secondary">
                              Status changed from {STATUS_META[prevStatus!].label}
                            </span>
                          ) : null}
                          {c.simulated ? (
                            <span className="rounded-full bg-select-tonal px-2 py-px text-[11px] font-semibold text-select-ink">
                              Simulated
                            </span>
                          ) : null}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        )}
        {narrow && filtered.length > 3 ? (
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
            className="mt-1.5 ml-1 text-[12.5px] font-semibold text-brand hover:underline"
          >
            {expanded ? "Show recent 3" : `Show all ${filtered.length} check-ins`}
          </button>
        ) : null}
      </div>
    </section>
  );
}

