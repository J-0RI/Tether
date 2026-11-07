import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Minus,
  Search,
  X,
} from "lucide-react";
import { Fragment, useLayoutEffect, useMemo, useRef, useState } from "react";
import { latestAnswered } from "../calculateStatus";
import {
  buildCalendarEventMap,
  prioritizeUpcomingSurgeries,
  recentCheckInDates,
} from "../lib/calendar";
import { daysUntil, fmtDate, relDays } from "../lib/dates";
import {
  buildCheckInFeed,
  computeOperationalMetrics,
  hasReadinessGap,
  isNoReply,
  isSurgerySoon,
  readinessBreakdown,
  type CheckInEventCategory,
  type CheckInFeedItem,
  type Row,
} from "../lib/derive";
import {
  EMPTY_FILTERS,
  hasActiveFilters,
  type Filters,
} from "../lib/filters";
import { CHANNEL_LABEL, READINESS_ITEMS } from "../lib/questions";
import type { Channel, ReadinessState, Status } from "../types";
import { CheckInDetailRecord } from "./CheckInRecord";
import {
  CompactScheduleCalendar,
  ExpandedClinicalCalendar,
} from "./ClinicalCalendar";
import { PatientTable, type TableSort } from "./PatientTable";
import {
  Button,
  ChannelBadge,
  SegmentedControl,
  StatusPill,
  WorkflowStateBadge,
} from "./ui";
import { inputCls, selectCls } from "./uiStyles";

export type FocusedSection =
  | null
  | "attention"
  | "checkins"
  | "readiness"
  | "waitlist";

/**
 * How many preview rows fit in a region's list area. The area is a flex child sized by the
 * grid, so it fills the region rather than leaving a gap above the footer. Never fewer than 3.
 */
function useFitCount(rowHeight: number): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [n, setN] = useState(3);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setN(Math.max(3, Math.floor(el.clientHeight / rowHeight)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [rowHeight]);
  return [ref, n];
}

function sentenceCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function SectionTitle({ tone, children }: { tone: "attention" | "readiness" | "checkins" | "waitlist"; children: React.ReactNode }) {
  return (
    <h2 className="inline-flex items-center gap-2 text-[16.5px] font-semibold text-ink">
      <span className={`dash-marker dash-marker-${tone}`} aria-hidden="true" />
      {children}
    </h2>
  );
}

export function DashboardWorkspace({
  rows,
  sort,
  onSort,
  filters,
  setFilters,
  selectedDate,
  onSelectDate,
  focused,
  onFocusChange,
  highlightId,
  updatedLabel,
  onOpenPatient,
}: {
  rows: Row[];
  sort: TableSort;
  onSort: (s: TableSort) => void;
  filters: Filters;
  setFilters: (f: Filters) => void;
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
  focused: FocusedSection;
  onFocusChange: (next: FocusedSection) => void;
  highlightId: string | null;
  updatedLabel: string;
  onOpenPatient: (id: string) => void;
}) {
  const metrics = useMemo(() => computeOperationalMetrics(rows), [rows]);
  const [attentionRef, attentionFit] = useFitCount(53);
  const [readinessRef, readinessFit] = useFitCount(49);
  const [checkinRef, checkinFit] = useFitCount(52);
  const [waitlistRef, waitlistFit] = useFitCount(51);
  const checkInFeed = useMemo(() => buildCheckInFeed(rows), [rows]);
  const eventMap = useMemo(
    () => buildCalendarEventMap(rows, checkInFeed),
    [rows, checkInFeed],
  );

  const procedures = useMemo(
    () => [...new Set(rows.map((r) => r.patient.procedureType))].sort(),
    [rows],
  );
  const sites = useMemo(
    () => [...new Set(rows.map((r) => r.patient.site))].sort(),
    [rows],
  );

  const filteredRows = useMemo(() => {
    const base = rows.filter(({ patient: p, result }) => {
      if (
        filters.q.trim() &&
        !p.name.toLowerCase().includes(filters.q.trim().toLowerCase()) &&
        !p.community.toLowerCase().includes(filters.q.trim().toLowerCase()) &&
        !p.procedure.toLowerCase().includes(filters.q.trim().toLowerCase())
      ) {
        return false;
      }
      if (filters.status !== "all" && result.status !== filters.status) {
        return false;
      }
      if (
        filters.procedure !== "all" &&
        p.procedureType !== filters.procedure
      ) {
        return false;
      }
      if (filters.site !== "all" && p.site !== filters.site) {
        return false;
      }
      if (filters.channel !== "all" && p.contactMethod !== filters.channel) {
        return false;
      }
      if (filters.special === "attention" && result.status === "ok") {
        return false;
      }
      if (filters.special === "noReply" && !isNoReply(p)) {
        return false;
      }
      if (filters.special === "soon" && !isSurgerySoon(p)) {
        return false;
      }
      if (filters.special === "readinessGap" && !hasReadinessGap(p)) {
        return false;
      }
      return true;
    });

    if (sort.key === "priority") return base;

    return [...base].sort((a, b) => {
      const dir = sort.descending ? -1 : 1;
      if (sort.key === "name") {
        return dir * a.patient.name.localeCompare(b.patient.name);
      }
      if (sort.key === "waiting") {
        return dir * (a.patient.weeksWaiting - b.patient.weeksWaiting);
      }
      if (!a.patient.surgeryDate) return b.patient.surgeryDate ? 1 : 0;
      if (!b.patient.surgeryDate) return -1;
      return dir * a.patient.surgeryDate.localeCompare(b.patient.surgeryDate);
    });
  }, [rows, filters, sort]);

  const attentionRows = useMemo(
    () => rows.filter((r) => r.result.status !== "ok"),
    [rows],
  );

  const onTrackRows = useMemo(
    () => rows.filter((r) => r.result.status === "ok"),
    [rows],
  );

  const upcomingPreviewRows = useMemo(
    () => prioritizeUpcomingSurgeries(rows, 12),
    [rows],
  );

  const recentDates = useMemo(
    () => recentCheckInDates(checkInFeed, 4),
    [checkInFeed],
  );

  const prioritizedRecentFeed = useMemo(() => {
    const priorityRank: Record<CheckInEventCategory, number> = {
      urgent: 0,
      "clinical-change": 1,
      missed: 2,
      routine: 3,
    };
    const latestPerPatient = checkInFeed.filter((item) => item.isLatestForPatient);
    return [...latestPerPatient].sort((a, b) => {
      const simDiff =
        Number(!!b.checkIn.simulated) - Number(!!a.checkIn.simulated);
      if (simDiff !== 0) return simDiff;
      const catDiff = priorityRank[a.category] - priorityRank[b.category];
      if (catDiff !== 0) return catDiff;
      return b.checkIn.date.localeCompare(a.checkIn.date);
    });
  }, [checkInFeed]);

  const openWaitlistWithStatus = (status: Status) => {
    setFilters({ ...EMPTY_FILTERS, status });
    onFocusChange("waitlist");
  };

  if (focused !== null) {
    return (
      <FocusedDetailContainer
        focused={focused}
        onBack={() => onFocusChange(null)}
        rows={rows}
        filteredRows={filteredRows}
        attentionRows={attentionRows}
        checkInFeed={checkInFeed}
        eventMap={eventMap}
        selectedDate={selectedDate}
        onSelectDate={onSelectDate}
        filters={filters}
        setFilters={setFilters}
        sort={sort}
        onSort={onSort}
        procedures={procedures}
        sites={sites}
        metrics={metrics}
        highlightId={highlightId}
        onOpenPatient={onOpenPatient}
      />
    );
  }

  const selectedDayData = selectedDate ? eventMap.get(selectedDate) : undefined;
  const checkInPreviewItems: CheckInFeedItem[] = selectedDate
    ? (selectedDayData?.checkIns ?? []).slice(0, checkinFit)
    : prioritizedRecentFeed.slice(0, checkinFit);
  const checkInTotalForSelected = selectedDayData?.checkIns.length ?? 0;

  return (
    <div className="flex flex-1 flex-col">
      {/* Compact Command-Centre Summary Strip (3-tier hierarchy, zero KPI duplication) */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 pb-2">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <h1 className="text-[23px] leading-[1.15] font-semibold tracking-[-0.025em] text-ink">
            Surgical waitlist
          </h1>

          <p className="text-[13.5px] text-ink-secondary">
            {metrics.act > 0 ? (
              <strong className="font-semibold text-act">
                {metrics.act}{" "}
                {metrics.act === 1
                  ? "patient needs immediate action"
                  : "patients need immediate action"}
              </strong>
            ) : (
              <strong className="font-semibold text-ok">
                No immediate action flags
              </strong>
            )}
            <span className="text-muted" aria-hidden="true">
              {" · "}
            </span>
            <span className="tabular">
              {metrics.watch} on Watch · {metrics.total} waiting ·{" "}
              {metrics.scheduled} surgeries scheduled
            </span>
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2.5 text-[12px] text-muted">
          {selectedDate ? (
            <button
              type="button"
              onClick={() => onSelectDate(null)}
              className="inline-flex items-center gap-1 rounded-full bg-select-tonal px-2.5 py-0.5 text-[11.5px] font-semibold text-select-ink hover:brightness-95"
            >
              <span>Date: {fmtDate(selectedDate, { year: false })}</span>
              <X className="size-3" aria-hidden="true" />
            </button>
          ) : null}
          <span className="tabular">
            Sat, Nov 7, 2026 · Updated {updatedLabel}
          </span>
        </div>
      </div>

      {/* Coordinated 2×2 Operational Workspace on Flat #FFFFFF */}
      <div className="command-grid">
        {/* ============================================================
            REGION 1 (TOP-LEFT): REQUIRES ATTENTION — Primary Triage Region
            ============================================================ */}
        <section className="command-region">
          <div className="mb-1.5 flex items-baseline justify-between gap-2">
            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
              <SectionTitle tone="attention">Requires attention</SectionTitle>
              <span className="tabular text-[12px] text-muted">
                <strong className="font-semibold text-act">
                  {metrics.act} Act now
                </strong>
                {" · "}
                <span className="font-medium text-watch">
                  {metrics.watch} Watch
                </span>
              </span>
            </div>

            <SectionExpandButton
              label={`View all ${attentionRows.length} flagged`}
              onClick={() => onFocusChange("attention")}
            />
          </div>

          {attentionRows.length === 0 ? (
            <div className="my-auto border-y border-line py-5 text-center text-[13px] text-muted">
              All clinical and pre-operative readiness flags are resolved.
            </div>
          ) : (
            <div ref={attentionRef} className="min-h-0 flex-1 overflow-hidden">
            <ol role="list" className="divide-y divide-line border-t border-line">
              {attentionRows.slice(0, attentionFit).map(({ patient: p, result }) => {
                const daysLeft = p.surgeryDate ? daysUntil(p.surgeryDate) : null;
                const urgentSurgery =
                  daysLeft !== null && daysLeft >= 0 && daysLeft <= 7;
                const primaryReason = result.reasons.map((r) => r.label).join(" · ");

                return (
                  <li
                    key={p.id}
                    className={highlightId === p.id ? "anim-flash" : ""}
                  >
                    <button
                      type="button"
                      onClick={() => onOpenPatient(p.id)}
                      className="group block w-full rounded-lg px-1.5 py-1.5 -mx-1.5 text-left transition-colors hover:bg-hover"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="truncate text-[14px] font-semibold text-ink group-hover:text-brand">
                            {p.name}
                          </span>
                          <StatusPill status={result.status} />
                        </div>

                        <span
                          className={`tabular shrink-0 text-[12px] ${
                            urgentSurgery
                              ? "font-semibold text-act"
                              : p.surgeryDate
                                ? "font-medium text-ink-secondary"
                                : "text-muted"
                          }`}
                        >
                          {p.surgeryDate
                            ? `Surgery ${relDays(p.surgeryDate)} · ${fmtDate(p.surgeryDate, { year: false })}`
                            : `Not yet booked · ${p.weeksWaiting} weeks waiting`}
                        </span>
                      </div>

                      <p className="mt-0.5 truncate text-[13px] text-ink-secondary" title={primaryReason}>
                        {primaryReason}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ol>
            </div>
          )}

          <div className="mt-auto flex items-center justify-between gap-2 pt-1.5 text-[12px] text-muted">
            {attentionRows.length > attentionFit ? (
              <span className="truncate">
                +{attentionRows.length - attentionFit} more flagged:{" "}
                {attentionRows
                  .slice(attentionFit)
                  .map((r) => r.patient.name)
                  .join(", ")}
              </span>
            ) : (
              <span>Most urgent first</span>
            )}
            <button
              type="button"
              onClick={() => onFocusChange("attention")}
              className="shrink-0 font-semibold text-brand hover:underline"
            >
              View all flagged patients →
            </button>
          </div>
        </section>

        {/* ============================================================
            REGION 2 (TOP-RIGHT): SURGERY READINESS + GOOGLE HEALTH CALENDAR
            ============================================================ */}
        <section className="command-region">
          <div className="mb-1.5 flex items-baseline justify-between gap-2">
            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
              <SectionTitle tone="readiness">Surgery readiness</SectionTitle>
              <span className="tabular text-[12px] text-muted">
                {metrics.scheduled} scheduled ·{" "}
                {metrics.scheduledReadinessGaps > 0 ? (
                  <strong className="font-semibold text-act">
                    {metrics.scheduledReadinessGaps} need preparation
                  </strong>
                ) : (
                  <span className="text-ok">all prepared</span>
                )}
              </span>
            </div>

            <SectionExpandButton
              label="Schedule"
              onClick={() => onFocusChange("readiness")}
            />
          </div>

          <CompactScheduleCalendar
            eventMap={eventMap}
            selectedDate={selectedDate}
            onSelectDate={onSelectDate}
          />

          {selectedDate ? (
            <div className="mt-1.5 flex flex-1 flex-col justify-between">
              <div>
                <div className="mb-1 flex items-center justify-between gap-2 text-[12px]">
                  <span className="font-semibold text-ink">
                    {fmtDate(selectedDate)} · {relDays(selectedDate)}
                  </span>
                  <button
                    type="button"
                    onClick={() => onSelectDate(null)}
                    className="font-semibold text-brand hover:underline"
                  >
                    Upcoming procedures
                  </button>
                </div>

                {selectedDayData && selectedDayData.surgeries.length > 0 ? (
                  <ol role="list" className="divide-y divide-line">
                    {selectedDayData.surgeries.map((s) => (
                      <li key={s.patientId} className="py-1.5">
                        <button
                          type="button"
                          onClick={() => onOpenPatient(s.patientId)}
                          className="group block w-full rounded-lg px-1.5 py-1 -mx-1.5 text-left hover:bg-hover"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-[13.5px] font-semibold text-ink group-hover:text-brand">
                                {s.patientName}
                              </span>
                              <StatusPill status={s.status} />
                            </div>
                            <span className="tabular text-[12px] font-medium text-ink-secondary">
                              {s.readyCount} of {s.totalCount} confirmed
                            </span>
                          </div>
                          <div className="mt-0.5 text-[12.5px] text-ink-secondary">
                            {s.procedure} · {s.site}
                          </div>
                          <div className="mt-0.5 flex items-baseline justify-between gap-2 text-[12px]">
                            <span
                              className={
                                s.missingLabels.length > 0
                                  ? "font-semibold text-act"
                                  : "font-medium text-ok"
                              }
                            >
                              {s.missingLabels.length > 0
                                ? `${sentenceCase(s.missingLabels.join(", "))}${s.missingDetail ? ` — ${s.missingDetail}` : ""}`
                                : "All due requirements confirmed"}
                            </span>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <div className="py-3 text-[12.5px] text-muted">
                    No surgeries booked on {fmtDate(selectedDate, { year: false })}.
                    {checkInTotalForSelected > 0
                      ? ` ${checkInTotalForSelected} patient check-in${checkInTotalForSelected === 1 ? " is" : "s are"} shown in Check-in activity.`
                      : " Select a highlighted surgical date or return to upcoming procedures."}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div ref={readinessRef} className="mt-1 min-h-0 flex-1 overflow-hidden">
            <ol role="list" className="divide-y divide-line">
              {upcomingPreviewRows.slice(0, readinessFit).map(({ patient: p }) => {
                const rb = readinessBreakdown(p.readiness);
                const missingItems = p.readiness.filter(
                  (r) => r.state === "missing",
                );
                const dLeft = daysUntil(p.surgeryDate!);
                const urgent = dLeft >= 0 && dLeft <= 7;

                return (
                  <li
                    key={p.id}
                    className={highlightId === p.id ? "anim-flash" : ""}
                  >
                    <button
                      type="button"
                      onClick={() => onOpenPatient(p.id)}
                      className="group block w-full rounded-lg px-1.5 py-1 -mx-1.5 text-left transition-colors hover:bg-hover"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-baseline gap-2">
                          <span
                            className={`tabular shrink-0 text-[12.5px] font-semibold ${
                              urgent ? "text-act" : "text-ink"
                            }`}
                          >
                            {fmtDate(p.surgeryDate!, { year: false })}
                          </span>
                          <span className="truncate text-[13.5px] font-semibold text-ink group-hover:text-brand">
                            {p.name}
                          </span>
                          <span className="hidden truncate text-[12px] text-muted sm:inline">
                            · {p.procedureType}
                          </span>
                        </div>

                        <span className="tabular shrink-0 text-[12px] font-medium text-ink-secondary">
                          {rb.ready} of {rb.total} confirmed
                        </span>
                      </div>

                      <div className="mt-0.5 flex items-baseline justify-between gap-2 text-[12px]">
                        {missingItems.length > 0 ? (
                          <span className="truncate font-medium text-act">
                            {sentenceCase(
                              missingItems
                                .map(
                                  (m) =>
                                    READINESS_ITEMS.find((i) => i.key === m.key)
                                      ?.missing,
                                )
                                .join(" · "),
                            )}
                          </span>
                        ) : (
                          <span className="truncate text-ok">
                            All due requirements confirmed
                          </span>
                        )}
                        <span className="tabular shrink-0 text-[11.5px] text-muted">
                          {relDays(p.surgeryDate!)}
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ol>
            </div>
          )}

          <div className="mt-auto flex items-center justify-between gap-2 pt-1.5 text-[12px] text-muted">
            <span>
              {selectedDate
                ? `${selectedDayData?.surgeries.length ?? 0} scheduled on ${fmtDate(selectedDate, { year: false })}`
                : metrics.scheduled > Math.min(readinessFit, upcomingPreviewRows.length)
                  ? `+${metrics.scheduled - Math.min(readinessFit, upcomingPreviewRows.length)} more scheduled`
                  : `${metrics.scheduled} surgeries scheduled`}
            </span>
            <button
              type="button"
              onClick={() => onFocusChange("readiness")}
              className="shrink-0 font-semibold text-brand hover:underline"
            >
              View schedule and checklists →
            </button>
          </div>
        </section>

        {/* ============================================================
            REGION 3 (BOTTOM-LEFT): CHECK-IN ACTIVITY
            ============================================================ */}
        <section className="command-region">
          <div className="mb-1.5 flex items-baseline justify-between gap-2">
            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
              <SectionTitle tone="checkins">Check-in activity</SectionTitle>
              <span className="tabular text-[12px] text-muted">
                {metrics.noReply > 0 ? (
                  <span className="font-medium text-watch">
                    {metrics.noReply} no reply for 14+ days
                  </span>
                ) : (
                  <span>All replied within 14 days</span>
                )}
              </span>
            </div>

            <SectionExpandButton
              label="All check-ins"
              onClick={() => onFocusChange("checkins")}
            />
          </div>

          {/* Expressive M3 Date Filter Strip (synced with shared selectedDate) */}
          <div
            role="group"
            aria-label="Filter recent check-ins by date"
            className="mb-1.5 flex flex-wrap items-center gap-1 border-y border-line py-1"
          >
            <button
              type="button"
              aria-pressed={selectedDate === null}
              onClick={() => onSelectDate(null)}
              className={`dash-chip ${selectedDate === null ? "dash-chip-on" : ""}`}
            >
              Most important
            </button>

            {recentDates.map((iso) => {
              const active = selectedDate === iso;
              return (
                <button
                  key={iso}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onSelectDate(active ? null : iso)}
                  className={`dash-chip tabular ${active ? "dash-chip-on" : ""}`}
                >
                  {fmtDate(iso, { year: false })}
                </button>
              );
            })}

            {selectedDate && !recentDates.includes(selectedDate) ? (
              <button
                type="button"
                aria-pressed={true}
                onClick={() => onSelectDate(null)}
                className="dash-chip dash-chip-on tabular inline-flex items-center gap-1"
              >
                <span>{fmtDate(selectedDate, { year: false })}</span>
                <X className="size-3" aria-hidden="true" />
              </button>
            ) : null}
          </div>

          <div ref={checkinRef} className="min-h-0 flex-1 overflow-hidden">
          {checkInPreviewItems.length === 0 ? (
            <div className="my-auto py-3 text-[12.5px] text-muted">
              No patient check-ins recorded on{" "}
              {selectedDate ? fmtDate(selectedDate, { year: false }) : "this date"}.{" "}
              <button
                type="button"
                onClick={() => onSelectDate(null)}
                className="font-semibold text-brand hover:underline"
              >
                Return to priority recent activity
              </button>
            </div>
          ) : (
            <ol role="list" className="divide-y divide-line">
              {checkInPreviewItems.map((item) => {
                const barCls =
                  item.category === "urgent"
                    ? "border-l-act-fill"
                    : item.category === "clinical-change" ||
                        item.category === "missed"
                      ? "border-l-watch-fill"
                      : "border-l-line-strong";
                const workflowState =
                  item.reviewed || item.category === "routine"
                    ? "reviewed"
                    : "needs-review";

                return (
                  <li
                    key={item.checkIn.id}
                    className={`py-1.5 ${
                      highlightId === item.patient.id && item.checkIn.simulated
                        ? "anim-flash"
                        : ""
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onOpenPatient(item.patient.id)}
                      className={`group block w-full border-l-2 pl-2.5 pr-1 text-left transition-colors hover:bg-hover ${barCls}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="truncate text-[13.5px] font-semibold text-ink group-hover:text-brand">
                            {item.patient.name}
                          </span>
                          <span className="tabular shrink-0 text-[11.5px] text-muted">
                            {fmtDate(item.checkIn.date, { year: false })} ·{" "}
                            {CHANNEL_LABEL[item.checkIn.channel]}
                          </span>
                          {item.checkIn.simulated ? (
                            <span className="rounded-full bg-select-tonal px-1.5 py-0.2 text-[10.5px] font-semibold text-select-ink">
                              New
                            </span>
                          ) : null}
                        </div>

                        {workflowState === "reviewed" && item.category !== "routine" ? (
                          <span className="inline-flex shrink-0 items-center gap-1 text-[11.5px] text-muted">
                            <Check className="size-3" aria-hidden="true" />
                            Reviewed
                          </span>
                        ) : null}
                      </div>

                      <p className="mt-0.5 truncate text-[12.5px] text-ink-secondary">
                        {item.headline}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
          </div>

          <div className="mt-auto flex items-center justify-between gap-2 pt-1.5 text-[12px] text-muted">
            <span>
              {selectedDate
                ? `${checkInTotalForSelected} event${checkInTotalForSelected === 1 ? "" : "s"} on ${fmtDate(selectedDate, { year: false })}`
                : `${checkInFeed.length} check-ins recorded`}
            </span>
            <button
              type="button"
              onClick={() => onFocusChange("checkins")}
              className="font-semibold text-brand hover:underline"
            >
              View check-ins →
            </button>
          </div>
        </section>

        {/* ============================================================
            REGION 4 (BOTTOM-RIGHT): COMPLETE PATIENT WAITLIST
            ============================================================ */}
        <section className="command-region">
          <div className="mb-1.5 flex items-baseline justify-between gap-2">
            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
              <SectionTitle tone="waitlist">Complete waitlist</SectionTitle>
              <span className="tabular text-[12px] text-muted">
                {metrics.total} waiting · {metrics.scheduled} scheduled ·{" "}
                {metrics.total - metrics.scheduled} not yet booked
              </span>
            </div>

            <SectionExpandButton
              label="All patients"
              onClick={() => onFocusChange("waitlist")}
            />
          </div>

          {/* Status distribution: tonal connected segments, each labelled with its count */}
          <div className="border-y border-line py-2">
            <div className="m3-connected-bar h-8 w-full" role="group" aria-label="Waitlist by status">
              {(
                [
                  ["act", metrics.act, "Act now", "bg-act-bg text-act"],
                  ["watch", metrics.watch, "Watch", "bg-watch-bg text-watch"],
                  ["ok", metrics.ok, "On track", "bg-ok-bg text-ok"],
                ] as const
              )
                .filter(([, n]) => n > 0)
                .map(([status, n, label, cls]) => (
                  <button
                    key={status}
                    type="button"
                    style={{ flexGrow: n, minWidth: "5.5rem" }}
                    onClick={() => openWaitlistWithStatus(status)}
                    aria-label={`${label}: ${n} patients. Show them in the waitlist.`}
                    className={`m3-connected-segment tabular flex h-full items-center gap-1.5 px-3 text-[12.5px] font-semibold whitespace-nowrap transition-[filter] hover:brightness-95 ${cls}`}
                  >
                    <span className="text-[15px]">{n}</span>
                    {label}
                  </button>
                ))}
            </div>
          </div>

          <h3 className="mt-2 text-[12px] font-semibold text-muted">Patients on track</h3>

          {/* Non-duplicative On-Track Patient Preview (Flat rows, no nested cards) */}
          <div ref={waitlistRef} className="min-h-0 flex-1 overflow-hidden">
          <ol role="list" className="divide-y divide-line">
            {onTrackRows.slice(0, waitlistFit).map(({ patient: p }) => {
              return (
                <li
                  key={p.id}
                  className={highlightId === p.id ? "anim-flash" : ""}
                >
                  <button
                    type="button"
                    onClick={() => onOpenPatient(p.id)}
                    className="group flex w-full items-center justify-between gap-3 rounded-lg px-1.5 py-1.5 -mx-1.5 text-left transition-colors hover:bg-hover"
                  >
                    <div className="min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="truncate text-[13.5px] font-semibold text-ink group-hover:text-brand">
                          {p.name}
                        </span>
                        <span className="truncate text-[12px] text-muted">
                          {p.procedureType}
                        </span>
                      </div>
                      <div className="truncate text-[12px] text-muted">
                        {p.site} · {p.community}
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <span className="tabular block text-[12px] font-medium text-ink-secondary">
                        {p.surgeryDate
                          ? fmtDate(p.surgeryDate, { year: false })
                          : `${p.weeksWaiting} weeks waiting`}
                      </span>
                      <span className="block text-[11px] font-medium text-ok">
                        On track
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ol>
          </div>

          <div className="mt-auto flex items-center justify-between gap-2 pt-1.5 text-[12px] text-muted">
            <span>
              {onTrackRows.length > waitlistFit
                ? `+${onTrackRows.length - waitlistFit} more on track`
                : `${onTrackRows.length} patients on track`}
            </span>
            <button
              type="button"
              onClick={() => {
                setFilters(EMPTY_FILTERS);
                onFocusChange("waitlist");
              }}
              className="font-semibold text-brand hover:underline"
            >
              Search all {rows.length} patients →
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function SectionExpandButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-track px-2.5 py-0.5 text-[12px] font-semibold text-ink-secondary transition-colors hover:bg-brand-tonal hover:text-brand-ink"
    >
      <span className="clinical-pill-label">{label}</span>
      <ArrowRight className="size-3.5" aria-hidden="true" />
    </button>
  );
}

/* ---- Full-Width Priority Triage Table (Used in Expanded Focus View) ---- */
function PriorityAttentionTable({
  rows,
  highlightId,
  onOpenPatient,
}: {
  rows: Row[];
  highlightId: string | null;
  onOpenPatient: (id: string) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="border-y border-line py-8 text-center text-[13.5px] text-muted">
        No patients match the selected triage filter.
      </div>
    );
  }

  return (
    <div className="clinical-table-wrap">
      <table className="clinical-table min-w-[960px]">
        <caption className="visually-hidden">
          Patients with an open clinical or readiness flag, most urgent first.
        </caption>
        <thead>
          <tr>
            <th scope="col">Patient</th>
            <th scope="col">Priority</th>
            <th scope="col">Reason for attention</th>
            <th scope="col">Procedure &amp; site</th>
            <th scope="col">Surgery timing</th>
            <th scope="col">Latest check-in</th>
            <th scope="col">Contact</th>
            <th scope="col">
              <span className="visually-hidden">Open record</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ patient: p, result }) => {
            const last = latestAnswered(p);
            const latestCi = p.checkIns.at(-1);
            const daysLeft = p.surgeryDate ? daysUntil(p.surgeryDate) : null;
            const urgentSurgery =
              daysLeft !== null && daysLeft >= 0 && daysLeft <= 7;

            return (
              <tr
                key={p.id}
                onClick={() => onOpenPatient(p.id)}
                className={`interactive-row ${
                  highlightId === p.id ? "anim-flash" : ""
                }`}
              >
                <td className="whitespace-nowrap">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenPatient(p.id);
                    }}
                    className="text-left text-[14px] font-semibold text-ink hover:text-brand hover:underline"
                  >
                    {p.name}
                  </button>
                  <div className="mt-0.5 text-[12px] text-muted">
                    {p.age}
                    {p.sex} · {p.community} ({p.distanceKm} km)
                  </div>
                </td>

                <td className="whitespace-nowrap">
                  <StatusPill status={result.status} />
                </td>

                <td className="max-w-[340px]">
                  <ul role="list" className="space-y-0.5">
                    {result.reasons.map((r) => (
                      <li
                        key={r.code}
                        className="text-[13px] font-medium text-ink"
                      >
                        {r.label}
                      </li>
                    ))}
                  </ul>
                  {last?.note ? (
                    <p className="mt-1 truncate text-[12px] text-muted">
                      “{last.note}”
                    </p>
                  ) : null}
                </td>

                <td>
                  <div className="text-[13px] font-medium text-ink">
                    {p.procedure}
                  </div>
                  <div className="mt-0.5 text-[12px] text-muted">
                    {p.site.replace(" Hospital", "")}
                  </div>
                </td>

                <td className="whitespace-nowrap">
                  {p.surgeryDate ? (
                    <>
                      <div
                        className={`text-[13px] font-semibold ${
                          urgentSurgery ? "text-act" : "text-ink"
                        }`}
                      >
                        {relDays(p.surgeryDate)}
                      </div>
                      <div className="mt-0.5 text-[12px] text-muted">
                        {fmtDate(p.surgeryDate, { year: false })}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-[12.5px] text-ink-secondary">
                        Unbooked
                      </div>
                      <div className="mt-0.5 text-[12px] text-muted">
                        {p.weeksWaiting}w waiting
                      </div>
                    </>
                  )}
                </td>

                <td className="whitespace-nowrap">
                  {latestCi?.missed ? (
                    <>
                      <div className="text-[12.5px] font-semibold text-watch">
                        No reply ({fmtDate(latestCi.date, { year: false })})
                      </div>
                      <div className="mt-0.5 text-[12px] text-muted">
                        Last answered{" "}
                        {last ? fmtDate(last.date, { year: false }) : "never"}
                      </div>
                    </>
                  ) : last?.answers ? (
                    <>
                      <div className="text-[12.5px] text-ink">
                        Pain <strong>{last.answers.pain}/10</strong> · Walk{" "}
                        <strong>{last.answers.walk}d</strong> ·{" "}
                        {last.answers.mood}
                      </div>
                      <div className="mt-0.5 text-[12px] text-muted">
                        {fmtDate(last.date, { year: false })}
                      </div>
                    </>
                  ) : (
                    <span className="text-[12px] text-muted">No check-ins</span>
                  )}
                </td>

                <td className="whitespace-nowrap">
                  <ChannelBadge channel={p.contactMethod} />
                </td>

                <td className="whitespace-nowrap">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenPatient(p.id);
                    }}
                    className="mt-1 inline-flex items-center gap-1 text-[12px] font-semibold text-brand hover:underline"
                  >
                    <span>Open patient record</span>
                    <ArrowRight className="size-3.5" aria-hidden="true" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ---- Search & Filter Bar (<search> semantic landmark) ---- */
function WaitlistFilterControls({
  filters,
  setFilters,
  sort,
  onSort,
  procedures,
  sites,
}: {
  filters: Filters;
  setFilters: (f: Filters) => void;
  sort: TableSort;
  onSort: (s: TableSort) => void;
  procedures: string[];
  sites: string[];
}) {
  const anyFilter = hasActiveFilters(filters);

  return (
    <search
      aria-label="Filter and sort surgical waitlist"
      className="mb-3 flex flex-wrap items-center gap-2"
    >
      <div className="relative min-w-[245px] max-w-[340px] flex-1">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
          aria-hidden="true"
        />
        <input
          type="search"
          value={filters.q}
          onChange={(e) => setFilters({ ...filters, q: e.target.value })}
          placeholder="Search patient, community, procedure…"
          aria-label="Search patient name, community, or procedure"
          className={`${inputCls} pl-9`}
        />
      </div>

      <select
        aria-label="Filter by clinical status"
        value={filters.status}
        onChange={(e) =>
          setFilters({
            ...filters,
            status: e.target.value as Filters["status"],
            special: null,
          })
        }
        className={selectCls}
      >
        <option value="all">All statuses</option>
        <option value="act">Act now</option>
        <option value="watch">Watch</option>
        <option value="ok">On track</option>
      </select>

      <select
        aria-label="Filter by procedure type"
        value={filters.procedure}
        onChange={(e) => setFilters({ ...filters, procedure: e.target.value })}
        className={selectCls}
      >
        <option value="all">All procedures</option>
        {procedures.map((proc) => (
          <option key={proc} value={proc}>
            {proc}
          </option>
        ))}
      </select>

      <select
        aria-label="Filter by hospital site"
        value={filters.site}
        onChange={(e) => setFilters({ ...filters, site: e.target.value })}
        className={selectCls}
      >
        <option value="all">All hospitals</option>
        {sites.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>

      <select
        aria-label="Filter by contact method"
        value={filters.channel}
        onChange={(e) =>
          setFilters({
            ...filters,
            channel: e.target.value as Filters["channel"],
          })
        }
        className={selectCls}
      >
        <option value="all">All contact methods</option>
        {(Object.keys(CHANNEL_LABEL) as Channel[]).map((c) => (
          <option key={c} value={c}>
            {CHANNEL_LABEL[c]}
          </option>
        ))}
      </select>

      <div className="ml-auto flex items-center gap-2">
        {anyFilter ? (
          <button
            type="button"
            onClick={() => setFilters(EMPTY_FILTERS)}
            className="inline-flex items-center gap-1 rounded-full bg-select-tonal px-3 py-1 text-[12px] font-semibold text-select-ink hover:brightness-95"
          >
            <X className="size-3.5" aria-hidden="true" />
            <span>Reset filters</span>
          </button>
        ) : null}

        <label className="inline-flex items-center gap-1.5 text-[12px] text-muted">
          <span>Sort:</span>
          <select
            aria-label="Sort waitlist"
            value={sort.key}
            onChange={(e) =>
              onSort({
                key: e.target.value as TableSort["key"],
                descending: false,
              })
            }
            className={selectCls}
          >
            <option value="priority">Clinical priority</option>
            <option value="name">Patient name</option>
            <option value="surgery">Surgery date</option>
            <option value="waiting">Weeks waiting</option>
          </select>
        </label>
      </div>
    </search>
  );
}

/* ---- Single-Active Focused Detail Workspace ---- */
function FocusedDetailContainer({
  focused,
  onBack,
  rows,
  filteredRows,
  attentionRows,
  checkInFeed,
  eventMap,
  selectedDate,
  onSelectDate,
  filters,
  setFilters,
  sort,
  onSort,
  procedures,
  sites,
  metrics,
  highlightId,
  onOpenPatient,
}: {
  focused: Exclude<FocusedSection, null>;
  onBack: () => void;
  rows: Row[];
  filteredRows: Row[];
  attentionRows: Row[];
  checkInFeed: ReturnType<typeof buildCheckInFeed>;
  eventMap: ReturnType<typeof buildCalendarEventMap>;
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
  filters: Filters;
  setFilters: (f: Filters) => void;
  sort: TableSort;
  onSort: (s: TableSort) => void;
  procedures: string[];
  sites: string[];
  metrics: ReturnType<typeof computeOperationalMetrics>;
  highlightId: string | null;
  onOpenPatient: (id: string) => void;
}) {
  const [feedFilter, setFeedFilter] = useState<
    "all" | "signals" | "missed" | "routine"
  >("all");
  const [feedChannel, setFeedChannel] = useState<"all" | Channel>("all");
  const [feedQuery, setFeedQuery] = useState("");
  const [openLogIds, setOpenLogIds] = useState<Set<string>>(() => new Set());

  const [readinessScope, setReadinessScope] = useState<
    "scheduled" | "gaps" | "all"
  >("scheduled");
  const [readinessQuery, setReadinessQuery] = useState("");
  const [expandedChecklistIds, setExpandedChecklistIds] = useState<Set<string>>(
    () => new Set(),
  );

  const [triageFilter, setTriageFilter] = useState<"all" | "act" | "watch">(
    "all",
  );
  const [triageQuery, setTriageQuery] = useState("");
  const [triageSort, setTriageSort] = useState<
    "priority" | "surgery" | "waiting" | "name"
  >("priority");

  const titles: Record<
    Exclude<FocusedSection, null>,
    { title: string; sub: string }
  > = {
    attention: {
      title: "Requires attention — prioritized clinical triage",
      sub: "Complete breakdown of active clinical deterioration, surgical intent, and pre-operative readiness flags.",
    },
    checkins: {
      title: "Check-in activity register",
      sub: "Chronological log of automated check-in responses, clinical changes, and overdue intervals.",
    },
    readiness: {
      title: "Surgery readiness & procedural schedule",
      sub: "Pre-operative checklist verification across scheduled procedures and waiting patients.",
    },
    waitlist: {
      title: "Complete surgical waitlist registry",
      sub: "Searchable, filterable population registry of all patients enrolled in surgical waitlist coordination.",
    },
  };

  const toggleLogItem = (id: string) =>
    setOpenLogIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleChecklist = (id: string) =>
    setExpandedChecklistIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const visibleFeed = checkInFeed.filter((item) => {
    if (selectedDate && item.checkIn.date !== selectedDate) {
      return false;
    }
    if (
      feedQuery.trim() &&
      !item.patient.name.toLowerCase().includes(feedQuery.trim().toLowerCase())
    ) {
      return false;
    }
    if (feedChannel !== "all" && item.checkIn.channel !== feedChannel) {
      return false;
    }
    if (feedFilter === "signals") {
      return item.category === "urgent" || item.category === "clinical-change";
    }
    if (feedFilter === "missed") return item.category === "missed";
    if (feedFilter === "routine") return item.category === "routine";
    return true;
  });

  const visibleReadinessRows = rows
    .filter(({ patient: p }) => {
      if (selectedDate && p.surgeryDate !== selectedDate) return false;
      if (
        readinessQuery.trim() &&
        !p.name.toLowerCase().includes(readinessQuery.trim().toLowerCase()) &&
        !p.procedure.toLowerCase().includes(readinessQuery.trim().toLowerCase())
      ) {
        return false;
      }
      if (!selectedDate) {
        if (readinessScope === "scheduled") return p.surgeryDate !== null;
        if (readinessScope === "gaps") return hasReadinessGap(p);
      }
      return true;
    })
    .sort((a, b) => {
      if (a.patient.surgeryDate && b.patient.surgeryDate) {
        return a.patient.surgeryDate.localeCompare(b.patient.surgeryDate);
      }
      if (a.patient.surgeryDate) return -1;
      if (b.patient.surgeryDate) return 1;
      return b.patient.weeksWaiting - a.patient.weeksWaiting;
    });

  const visibleTriageRows = useMemo(() => {
    const filtered = attentionRows.filter(({ patient: p, result }) => {
      if (triageFilter !== "all" && result.status !== triageFilter) {
        return false;
      }
      if (
        triageQuery.trim() &&
        !p.name.toLowerCase().includes(triageQuery.trim().toLowerCase()) &&
        !p.procedure.toLowerCase().includes(triageQuery.trim().toLowerCase()) &&
        !p.community.toLowerCase().includes(triageQuery.trim().toLowerCase())
      ) {
        return false;
      }
      return true;
    });

    if (triageSort === "priority") return filtered;
    return [...filtered].sort((a, b) => {
      if (triageSort === "name") {
        return a.patient.name.localeCompare(b.patient.name);
      }
      if (triageSort === "waiting") {
        return b.patient.weeksWaiting - a.patient.weeksWaiting;
      }
      if (!a.patient.surgeryDate) return b.patient.surgeryDate ? 1 : 0;
      if (!b.patient.surgeryDate) return -1;
      return a.patient.surgeryDate.localeCompare(b.patient.surgeryDate);
    });
  }, [attentionRows, triageFilter, triageQuery, triageSort]);

  return (
    <div className="anim-enter space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-3">
        <div>
          <Button variant="tonal" size="sm" onClick={onBack}>
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            <span>Back to overview</span>
          </Button>
          <h1 className="mt-2 text-[22px] font-semibold tracking-[-0.02em] text-ink">
            {titles[focused].title}
          </h1>
          <p className="mt-0.5 text-[13px] text-muted">{titles[focused].sub}</p>
        </div>

        {focused === "attention" ? (
          <SegmentedControl
            label="Filter triage queue"
            value={triageFilter}
            onChange={setTriageFilter}
            options={[
              { id: "all", label: "All flagged", count: attentionRows.length },
              {
                id: "act",
                label: "Act now",
                count: attentionRows.filter((r) => r.result.status === "act")
                  .length,
              },
              {
                id: "watch",
                label: "Watch",
                count: attentionRows.filter((r) => r.result.status === "watch")
                  .length,
              },
            ]}
          />
        ) : focused === "readiness" ? (
          <SegmentedControl
            label="Readiness register scope"
            value={readinessScope}
            onChange={(next) => {
              onSelectDate(null);
              setReadinessScope(next);
            }}
            options={[
              {
                id: "scheduled",
                label: "Booked surgeries",
                count: rows.filter((r) => r.patient.surgeryDate !== null)
                  .length,
              },
              {
                id: "gaps",
                label: "Missing items",
                count: rows.filter((r) => hasReadinessGap(r.patient)).length,
              },
              { id: "all", label: "All patients", count: rows.length },
            ]}
          />
        ) : null}
      </div>

      {/* ---- EXPANDED: REQUIRES ATTENTION ---- */}
      {focused === "attention" ? (
        <div className="space-y-3">
          <search
            aria-label="Search and sort triage queue"
            className="flex flex-wrap items-center justify-between gap-2"
          >
            <div className="relative min-w-[220px] max-w-[320px] flex-1">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
                aria-hidden="true"
              />
              <input
                type="search"
                value={triageQuery}
                onChange={(e) => setTriageQuery(e.target.value)}
                placeholder="Search flagged patient or procedure…"
                aria-label="Search flagged patient, community, or procedure"
                className={`${inputCls} pl-9`}
              />
            </div>

            <label className="inline-flex items-center gap-1.5 text-[12px] text-muted">
              <span>Order by:</span>
              <select
                aria-label="Sort flagged patients"
                value={triageSort}
                onChange={(e) =>
                  setTriageSort(
                    e.target.value as
                      | "priority"
                      | "surgery"
                      | "waiting"
                      | "name",
                  )
                }
                className={selectCls}
              >
                <option value="priority">Clinical priority</option>
                <option value="surgery">Surgery date</option>
                <option value="waiting">Weeks waiting</option>
                <option value="name">Patient name</option>
              </select>
            </label>
          </search>

          <PriorityAttentionTable
            rows={visibleTriageRows}
            highlightId={highlightId}
            onOpenPatient={onOpenPatient}
          />
        </div>
      ) : null}

      {/* ---- EXPANDED: COMPLETE WAITLIST ---- */}
      {focused === "waitlist" ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-2.5 text-[12.5px]">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-semibold text-ink">
                {metrics.total} active patients
              </span>
              <span className="text-muted">·</span>
              <span className="font-medium text-act">{metrics.act} Act now</span>
              <span className="font-medium text-watch">
                {metrics.watch} Watch
              </span>
              <span className="font-medium text-ok">{metrics.ok} On track</span>
            </div>
            <span className="text-muted">
              {filteredRows.length} of {rows.length} shown
            </span>
          </div>

          <WaitlistFilterControls
            filters={filters}
            setFilters={setFilters}
            sort={sort}
            onSort={onSort}
            procedures={procedures}
            sites={sites}
          />
          <PatientTable
            rows={filteredRows}
            highlightId={highlightId}
            onOpen={onOpenPatient}
            onClearFilters={() => setFilters(EMPTY_FILTERS)}
            sort={sort}
            onSort={onSort}
          />
        </div>
      ) : null}

      {/* ---- EXPANDED: CHECK-IN ACTIVITY + CALENDAR ---- */}
      {focused === "checkins" ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[288px_minmax(0,1fr)]">
          <ExpandedClinicalCalendar
            eventMap={eventMap}
            selectedDate={selectedDate}
            onSelectDate={onSelectDate}
            lens="checkins"
            onOpenPatient={onOpenPatient}
          />

          <div className="min-w-0 space-y-3">
            <search
              aria-label="Search and filter check-in activity log"
              className="flex flex-wrap items-center justify-between gap-2"
            >
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[200px]">
                  <Search
                    className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    value={feedQuery}
                    onChange={(e) => setFeedQuery(e.target.value)}
                    placeholder="Search patient name…"
                    aria-label="Search check-ins by patient name"
                    className={`${inputCls} pl-9`}
                  />
                </div>

                <select
                  aria-label="Filter check-ins by contact method"
                  value={feedChannel}
                  onChange={(e) =>
                    setFeedChannel(e.target.value as "all" | Channel)
                  }
                  className={selectCls}
                >
                  <option value="all">All channels</option>
                  <option value="text">Text</option>
                  <option value="phone">Phone call</option>
                  <option value="caregiver">Caregiver</option>
                </select>

                {selectedDate ? (
                  <button
                    type="button"
                    onClick={() => onSelectDate(null)}
                    className="inline-flex items-center gap-1 rounded-full bg-select-tonal px-2.5 py-1 text-[12px] font-semibold text-select-ink hover:brightness-95"
                  >
                    <span>{fmtDate(selectedDate, { year: false })}</span>
                    <X className="size-3.5" aria-hidden="true" />
                  </button>
                ) : null}
              </div>

              <SegmentedControl
                label="Filter check-in events"
                value={feedFilter}
                onChange={setFeedFilter}
                options={[
                  { id: "all", label: "All", count: checkInFeed.length },
                  {
                    id: "signals",
                    label: "Clinical flags",
                    count: checkInFeed.filter(
                      (i) =>
                        i.category === "urgent" ||
                        i.category === "clinical-change",
                    ).length,
                  },
                  {
                    id: "missed",
                    label: "Missed",
                    count: checkInFeed.filter((i) => i.category === "missed")
                      .length,
                  },
                  {
                    id: "routine",
                    label: "Routine",
                    count: checkInFeed.filter((i) => i.category === "routine")
                      .length,
                  },
                ]}
              />
            </search>

            <div className="text-[12px] text-muted">
              Showing {visibleFeed.length} of {checkInFeed.length} check-in
              events
              {selectedDate ? ` on ${fmtDate(selectedDate)}` : ""} · Fictional
              sample communications only.
            </div>

            {visibleFeed.length === 0 ? (
              <div className="border-y border-line py-8 text-center text-[13px] text-muted">
                No check-in events match the current date or filter selection.
              </div>
            ) : (
              <ol
                role="list"
                className="divide-y divide-line border-y border-line-strong"
              >
                {visibleFeed.map((item) => {
                  const isOpen = openLogIds.has(item.checkIn.id);
                  const barCls =
                    item.category === "urgent"
                      ? "border-l-act-fill"
                      : item.category === "clinical-change" ||
                          item.category === "missed"
                        ? "border-l-watch-fill"
                        : "border-l-line-strong";
                  const workflowState =
                    item.reviewed || item.category === "routine"
                      ? "reviewed"
                      : "needs-review";

                  return (
                    <li key={item.checkIn.id} className="py-2.5">
                      <div
                        className={`flex flex-wrap items-center justify-between gap-3 border-l-2 pl-3 ${barCls}`}
                      >
                        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="tabular w-[94px] shrink-0 text-[12.5px] font-semibold text-ink">
                            {fmtDate(item.checkIn.date)}
                          </span>
                          <button
                            type="button"
                            onClick={() => onOpenPatient(item.patient.id)}
                            className="w-[150px] shrink-0 text-left text-[13.5px] font-semibold text-brand hover:underline"
                          >
                            {item.patient.name}
                          </button>
                          <ChannelBadge channel={item.checkIn.channel} />
                          <span className="min-w-[180px] flex-1 text-[13px] text-ink">
                            {item.headline}
                          </span>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          {workflowState === "reviewed" && item.category !== "routine" ? (
                          <span className="inline-flex shrink-0 items-center gap-1 text-[11.5px] text-muted">
                            <Check className="size-3" aria-hidden="true" />
                            Reviewed
                          </span>
                        ) : null}
                          <button
                            type="button"
                            aria-expanded={isOpen}
                            onClick={() => toggleLogItem(item.checkIn.id)}
                            className="rounded-full border border-line-strong px-2.5 py-0.5 text-[12px] font-semibold text-ink-secondary hover:bg-hover"
                          >
                            {isOpen ? "Hide Q&A" : "Inspect Q&A"}
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenPatient(item.patient.id)}
                            className="rounded-full bg-track px-2.5 py-0.5 text-[12px] font-semibold text-brand hover:bg-brand-tonal"
                          >
                            Record →
                          </button>
                        </div>
                      </div>

                      {isOpen ? (
                        <div className="mt-2 pl-3">
                          <CheckInDetailRecord
                            checkIn={item.checkIn}
                            patient={item.patient}
                          />
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </div>
      ) : null}

      {/* ---- EXPANDED: SURGERY READINESS + CALENDAR ---- */}
      {focused === "readiness" ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[288px_minmax(0,1fr)]">
          <ExpandedClinicalCalendar
            eventMap={eventMap}
            selectedDate={selectedDate}
            onSelectDate={onSelectDate}
            lens="schedule"
            onOpenPatient={onOpenPatient}
          />

          <div className="min-w-0 space-y-3">
            <search
              aria-label="Filter surgery readiness register"
              className="flex flex-wrap items-center justify-between gap-2"
            >
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-full sm:w-[260px]">
                  <Search
                    className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    value={readinessQuery}
                    onChange={(e) => setReadinessQuery(e.target.value)}
                    placeholder="Search patient or procedure…"
                    aria-label="Search readiness register by patient or procedure"
                    className={`${inputCls} pl-9`}
                  />
                </div>

                {selectedDate ? (
                  <button
                    type="button"
                    onClick={() => onSelectDate(null)}
                    className="inline-flex items-center gap-1 rounded-full bg-select-tonal px-2.5 py-1 text-[12px] font-semibold text-select-ink hover:brightness-95"
                  >
                    <span>Date: {fmtDate(selectedDate, { year: false })}</span>
                    <X className="size-3.5" aria-hidden="true" />
                  </button>
                ) : null}
              </div>

              <span className="text-[12px] text-muted">
                {visibleReadinessRows.length}{" "}
                {visibleReadinessRows.length === 1 ? "patient" : "patients"}{" "}
                shown
              </span>
            </search>

            {visibleReadinessRows.length === 0 ? (
              <div className="border-y border-line py-8 text-center text-[13px] text-muted">
                No procedures match the selected date or filter.{" "}
                {selectedDate ? (
                  <button
                    type="button"
                    onClick={() => onSelectDate(null)}
                    className="font-semibold text-brand hover:underline"
                  >
                    Show all booked surgeries
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="clinical-table-wrap">
                <table className="clinical-table min-w-[820px]">
                  <caption className="visually-hidden">
                    Surgery readiness register across pre-operative preparation
                    requirements
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Surgery date</th>
                      <th scope="col">Patient &amp; procedure</th>
                      <th scope="col">Priority</th>
                      <th scope="col">Readiness</th>
                      <th scope="col">Missing requirements</th>
                      <th scope="col">Review state</th>
                      <th scope="col" className="text-right">
                        Checklist &amp; record
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleReadinessRows.map(({ patient: p, result }) => {
                      const rb = readinessBreakdown(p.readiness);
                      const missing = p.readiness.filter(
                        (r) => r.state === "missing",
                      );
                      const dLeft = p.surgeryDate
                        ? daysUntil(p.surgeryDate)
                        : null;
                      const urgent =
                        dLeft !== null && dLeft >= 0 && dLeft <= 7;
                      const isExpanded = expandedChecklistIds.has(p.id);
                      const hasLoggedCallOrReview = p.activity.some(
                        (a) => a.kind === "review" || a.kind === "call",
                      );

                      return (
                        <Fragment key={p.id}>
                          <tr className="interactive-row">
                            <td
                              className="whitespace-nowrap"
                              onClick={() => toggleChecklist(p.id)}
                            >
                              {p.surgeryDate ? (
                                <>
                                  <div
                                    className={`text-[13.5px] font-semibold ${
                                      urgent ? "text-act" : "text-ink"
                                    }`}
                                  >
                                    {fmtDate(p.surgeryDate, { year: false })}
                                  </div>
                                  <div
                                    className={`text-[12px] ${
                                      urgent
                                        ? "font-semibold text-act"
                                        : "text-muted"
                                    }`}
                                  >
                                    {relDays(p.surgeryDate)}
                                  </div>
                                </>
                              ) : (
                                <span className="text-[12.5px] text-muted">
                                  Unbooked ({p.weeksWaiting}w)
                                </span>
                              )}
                            </td>

                            <td onClick={() => onOpenPatient(p.id)}>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onOpenPatient(p.id);
                                }}
                                className="text-left text-[13.5px] font-semibold text-ink hover:text-brand hover:underline"
                              >
                                {p.name}
                              </button>
                              <div className="text-[12px] text-muted">
                                {p.procedure} ·{" "}
                                {p.site.replace(" Hospital", "")}
                              </div>
                            </td>

                            <td
                              className="whitespace-nowrap"
                              onClick={() => toggleChecklist(p.id)}
                            >
                              <StatusPill status={result.status} />
                            </td>

                            <td
                              className="whitespace-nowrap"
                              onClick={() => toggleChecklist(p.id)}
                            >
                              <div className="flex items-center gap-2">
                                <ReadinessMiniSegments items={p.readiness} />
                                <span className="tabular text-[13px] font-semibold text-ink">
                                  {rb.ready} of {rb.total} confirmed
                                </span>
                              </div>
                              <div className="mt-0.5 text-[11.5px] text-muted">
                                {rb.notDue > 0
                                  ? `${rb.notDue} not yet due`
                                  : "All due"}
                                {rb.na > 0 ? ` · ${rb.na} N/A` : ""}
                              </div>
                            </td>

                            <td
                              className="max-w-[260px]"
                              onClick={() => toggleChecklist(p.id)}
                            >
                              {missing.length > 0 ? (
                                <ul role="list" className="space-y-0.5">
                                  {missing.map((m) => (
                                    <li
                                      key={m.key}
                                      className="text-[12.5px] font-semibold text-act"
                                    >
                                      {
                                        READINESS_ITEMS.find(
                                          (i) => i.key === m.key,
                                        )?.label
                                      }
                                      {m.detail ? (
                                        <span className="font-normal text-ink-secondary">
                                          {" "}
                                          ({m.detail})
                                        </span>
                                      ) : null}
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <span className="text-[12.5px] text-ok">
                                  All due items confirmed
                                </span>
                              )}
                            </td>

                            <td
                              className="whitespace-nowrap"
                              onClick={() => toggleChecklist(p.id)}
                            >
                              <WorkflowStateBadge
                                state={
                                  missing.length > 0
                                    ? "needs-review"
                                    : hasLoggedCallOrReview
                                      ? "reviewed"
                                      : "pending"
                                }
                              />
                            </td>

                            <td className="text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  aria-expanded={isExpanded}
                                  onClick={() => toggleChecklist(p.id)}
                                  className="inline-flex items-center gap-1 rounded-full border border-line-strong px-2.5 py-0.5 text-[11.5px] font-semibold text-ink-secondary hover:bg-hover"
                                >
                                  <span>9 items</span>
                                  {isExpanded ? (
                                    <ChevronUp
                                      className="size-3"
                                      aria-hidden="true"
                                    />
                                  ) : (
                                    <ChevronDown
                                      className="size-3"
                                      aria-hidden="true"
                                    />
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onOpenPatient(p.id)}
                                  className="rounded-full bg-track px-2.5 py-0.5 text-[11.5px] font-semibold text-brand hover:bg-brand-tonal"
                                >
                                  Record →
                                </button>
                              </div>
                            </td>
                          </tr>

                          {isExpanded ? (
                            <tr>
                              <td colSpan={7} className="bg-hover/50 px-3 py-3">
                                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                  <span className="text-[12.5px] font-semibold text-ink">
                                    Readiness checklist — {p.name}
                                  </span>
                                </div>
                                <ul
                                  role="list"
                                  className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 xl:grid-cols-3"
                                >
                                  {READINESS_ITEMS.map((def) => {
                                    const item = p.readiness.find(
                                      (x) => x.key === def.key,
                                    );
                                    const state: ReadinessState =
                                      item?.state ?? "notdue";
                                    return (
                                      <li
                                        key={def.key}
                                        className="flex items-start justify-between gap-2 rounded-lg border border-line bg-white px-2.5 py-1.5 text-[12px]"
                                      >
                                        <div className="min-w-0">
                                          <div
                                            className={`font-medium ${
                                              state === "missing"
                                                ? "font-semibold text-act"
                                                : state === "na"
                                                  ? "text-muted line-through"
                                                  : "text-ink"
                                            }`}
                                          >
                                            {def.label}
                                          </div>
                                          {item?.detail ? (
                                            <div className="truncate text-[11px] text-muted">
                                              {item.detail}
                                            </div>
                                          ) : null}
                                        </div>
                                        <ReadinessStateLabel
                                          state={state}
                                          date={item?.date}
                                        />
                                      </li>
                                    );
                                  })}
                                </ul>
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <p className="text-[12px] text-muted">
              Unrecorded or not-yet-due items are never counted as confirmed;
              non-applicable items are excluded from the denominator.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ReadinessStateLabel({
  state,
  date,
}: {
  state: ReadinessState;
  date?: string;
}) {
  if (state === "done") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-ok">
        <Check className="size-3" strokeWidth={2.5} aria-hidden="true" />
        <span>{date ? fmtDate(date, { year: false }) : "Confirmed"}</span>
      </span>
    );
  }
  if (state === "missing") {
    return (
      <span className="shrink-0 rounded-full bg-act-bg px-2 py-0.2 text-[11px] font-semibold text-act">
        Missing
      </span>
    );
  }
  if (state === "notdue") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-muted">
        <Clock className="size-3" aria-hidden="true" />
        <span>Not due</span>
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-0.5 text-[11px] text-muted">
      <Minus className="size-3" aria-hidden="true" />
      <span>N/A</span>
    </span>
  );
}

/**
 * Connected mini readiness indicator representing only applicable items:
 * Confirmed (`done`), Missing (`missing`), and Not yet due (`notdue`).
 * Non-applicable (`na`) items are omitted so the segments match `ready/total`.
 */
export function ReadinessMiniSegments({
  items,
}: {
  items: Row["patient"]["readiness"];
}) {
  const applicable = items.filter((i) => i.state !== "na");
  const segCls: Record<Exclude<ReadinessState, "na">, string> = {
    done: "bg-ok-fill",
    missing: "bg-act-fill",
    notdue: "bg-line-strong",
  };
  return (
    <span
      className="m3-connected-bar inline-flex h-1.5 w-[56px] bg-track"
      aria-hidden="true"
    >
      {applicable.map((item) => (
        <span
          key={item.key}
          style={{ flexGrow: 1 }}
          className={`m3-connected-segment h-full ${segCls[item.state as Exclude<ReadinessState, "na">]}`}
        />
      ))}
    </span>
  );
}
