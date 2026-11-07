import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { useState } from "react";
import {
  WEEKDAY_HEADERS,
  addDays,
  buildMonthGrid,
  buildTwoWeekGrid,
  defaultCalendarMonday,
  startOfMondayWeek,
  type CalendarCell,
  type CalendarDayData,
  type CalendarLens,
} from "../lib/calendar";
import { DEMO_DATE, fmtDate, parseDate, relDays } from "../lib/dates";
import { CHANNEL_LABEL } from "../lib/questions";
import { SegmentedControl, StatusPill } from "./ui";

function formatTwoWeekRange(mondayIso: string): string {
  const start = parseDate(mondayIso);
  const end = parseDate(addDays(mondayIso, 13));
  const sameMonth = start.getMonth() === end.getMonth();
  const sameYear = start.getFullYear() === end.getFullYear();
  const startMonth = start.toLocaleDateString("en-US", { month: "short" });
  const endMonth = end.toLocaleDateString("en-US", { month: "short" });
  if (sameMonth) {
    return `${startMonth} ${start.getDate()}–${end.getDate()}, ${end.getFullYear()}`;
  }
  if (sameYear) {
    return `${startMonth} ${start.getDate()} – ${endMonth} ${end.getDate()}, ${end.getFullYear()}`;
  }
  return `${fmtDate(mondayIso)} – ${fmtDate(addDays(mondayIso, 13))}`;
}

function buildDayAriaLabel(cell: CalendarCell): string {
  const parts: string[] = [
    parseDate(cell.date).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
  ];
  if (cell.isToday) parts.push("demo current date");
  if (cell.surgeries.length > 0) {
    const names = cell.surgeries.map((s) => s.patientName).join(", ");
    parts.push(
      `${cell.surgeries.length} scheduled ${cell.surgeries.length === 1 ? "surgery" : "surgeries"} (${names})${
        cell.hasReadinessIssue ? ", open readiness item" : ", readiness on track"
      }`,
    );
  }
  if (cell.checkIns.length > 0) {
    parts.push(
      `${cell.checkIns.length} patient check-in${cell.checkIns.length === 1 ? "" : "s"}`,
    );
  }
  if (cell.surgeries.length === 0 && cell.checkIns.length === 0) {
    parts.push("no scheduled events");
  }
  return parts.join(", ");
}

function CalendarWeekGrid({
  weeks,
  selectedDate,
  onSelectDate,
  compact,
}: {
  weeks: CalendarCell[][];
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
  compact: boolean;
}) {
  return (
    <div role="grid" aria-label="Clinical schedule calendar" className="select-none">
      <div
        role="row"
        className={`grid grid-cols-7 text-center font-medium text-muted ${
          compact ? "mb-1 text-[10.5px]" : "mb-1.5 text-[11.5px]"
        }`}
      >
        {WEEKDAY_HEADERS.map((d) => (
          <span key={d.full} role="columnheader" aria-label={d.full}>
            {d.short}
          </span>
        ))}
      </div>

      <div className={compact ? "space-y-[3px]" : "space-y-1.5"}>
        {weeks.map((week, wIdx) => (
          <div key={week[0].date} role="row" className="grid grid-cols-7">
            {week.map((cell, cIdx) => {
              const isSelected = selectedDate === cell.date;
              const hasSurgery = cell.surgeries.length > 0;
              const hasCheckIns = cell.checkIns.length > 0;

              // Connected capsule geometry across adjacent days in the same band
              const prevSameRow =
                cIdx > 0 &&
                week[cIdx - 1].inBand &&
                week[cIdx - 1].bandTone === cell.bandTone;
              const nextSameRow =
                cIdx < 6 &&
                week[cIdx + 1].inBand &&
                week[cIdx + 1].bandTone === cell.bandTone;
              const prevWrapped =
                cIdx === 0 &&
                wIdx > 0 &&
                weeks[wIdx - 1][6].inBand &&
                weeks[wIdx - 1][6].bandTone === cell.bandTone;
              const nextWrapped =
                cIdx === 6 &&
                wIdx < weeks.length - 1 &&
                weeks[wIdx + 1][0].inBand &&
                weeks[wIdx + 1][0].bandTone === cell.bandTone;

              let bandStyleCls = "";
              if (cell.inBand && cell.bandTone) {
                const bg =
                  cell.bandTone === "imminent"
                    ? "bg-brand-tonal/80"
                    : cell.bandTone === "surgical-cluster"
                      ? "bg-track"
                      : "bg-select-tonal/50";
                const leftCls = prevSameRow
                  ? "left-0"
                  : prevWrapped
                    ? "left-0 rounded-l-md"
                    : "left-1 rounded-l-full";
                const rightCls = nextSameRow
                  ? "right-0"
                  : nextWrapped
                    ? "right-0 rounded-r-md"
                    : "right-1 rounded-r-full";
                bandStyleCls = `${bg} ${leftCls} ${rightCls}`;
              }

              // Circular day button state (Google Cycle Health-inspired hierarchy)
              let circleCls = "";
              if (hasSurgery && cell.hasReadinessIssue) {
                circleCls = "bg-act-fill text-white font-semibold";
              } else if (hasSurgery) {
                circleCls = "bg-brand text-white font-semibold";
              } else if (isSelected) {
                circleCls = "bg-select text-white font-semibold";
              } else if (cell.isToday) {
                circleCls =
                  "border-[1.75px] border-dashed border-brand bg-white text-brand-ink font-bold";
              } else if (hasCheckIns) {
                circleCls = cell.inCurrentPeriod
                  ? "text-ink font-semibold hover:bg-white/90"
                  : "text-muted font-medium hover:bg-hover";
              } else {
                circleCls = cell.inCurrentPeriod
                  ? "text-ink-secondary font-normal hover:bg-hover hover:text-ink"
                  : "text-muted/45 font-normal hover:bg-hover";
              }

              // Expressive outer ring on selected date (mirrors Cycle Health day-4 ring)
              const selectedRingCls = isSelected
                ? "ring-2 ring-ink ring-offset-[1.5px] ring-offset-white"
                : "";

              const dotCls =
                !hasSurgery && hasCheckIns && !isSelected
                  ? cell.hasUrgentCheckIn
                    ? "bg-act-fill"
                    : cell.hasClinicalSignal
                      ? "bg-watch-fill"
                      : "bg-brand/65"
                  : null;

              return (
                <div
                  key={cell.date}
                  role="gridcell"
                  className={`relative flex items-center justify-center ${
                    compact ? "h-[28px]" : "h-[36px]"
                  }`}
                >
                  {cell.inBand ? (
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none absolute inset-y-[1px] ${bandStyleCls}`}
                    />
                  ) : null}

                  <button
                    type="button"
                    aria-pressed={isSelected}
                    aria-label={buildDayAriaLabel(cell)}
                    onClick={() =>
                      onSelectDate(isSelected ? null : cell.date)
                    }
                    className={`tabular relative z-10 inline-flex items-center justify-center rounded-full transition-colors ${
                      compact
                        ? "size-[25px] text-[11.5px]"
                        : "size-[31px] text-[12.5px]"
                    } ${circleCls} ${selectedRingCls}`}
                  >
                    <span className={dotCls ? "-translate-y-[1.5px]" : undefined}>
                      {cell.dayOfMonth}
                    </span>
                    {dotCls ? (
                      <span
                        aria-hidden="true"
                        className={`absolute rounded-full ${
                          compact
                            ? "bottom-[1.5px] size-[3.5px]"
                            : "bottom-[2.5px] size-[4px]"
                        } ${dotCls}`}
                      />
                    ) : null}
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Compact 2-week Google Health-inspired calendar unit for the single-screen
 * Surgery Readiness overview. Displays the connected 7-day pre-op readiness
 * window, current demo date, scheduled surgeries, and check-in activity.
 */
export function CompactScheduleCalendar({
  eventMap,
  selectedDate,
  onSelectDate,
}: {
  eventMap: Map<string, CalendarDayData>;
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
}) {
  const defaultMon = defaultCalendarMonday();
  const [anchorMonday, setAnchorMonday] = useState<string>(() =>
    selectedDate ? startOfMondayWeek(selectedDate) : defaultMon,
  );
  const [prevSelected, setPrevSelected] = useState<string | null>(selectedDate);

  if (prevSelected !== selectedDate) {
    setPrevSelected(selectedDate);
    if (selectedDate) {
      const endIso = addDays(anchorMonday, 13);
      if (selectedDate < anchorMonday || selectedDate > endIso) {
        setAnchorMonday(startOfMondayWeek(selectedDate));
      }
    }
  }

  const weeks = buildTwoWeekGrid(anchorMonday, eventMap, "schedule");
  const isShifted = anchorMonday !== defaultMon;

  const handleReset = () => {
    setAnchorMonday(defaultMon);
    onSelectDate(null);
  };

  return (
    <div className="border-y border-line py-1.5">
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="tabular text-[12px] font-semibold text-ink">
            {formatTwoWeekRange(anchorMonday)}
          </span>
          {selectedDate || isShifted ? (
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1 rounded-full bg-select-tonal px-2 py-0.5 text-[10.5px] font-semibold text-select-ink hover:brightness-95"
            >
              <RotateCcw className="size-2.5" aria-hidden="true" />
              <span>Today</span>
            </button>
          ) : null}
        </div>

        <div className="flex items-center gap-2.5">
          {/* Concise non-color-only visual key */}
          <div
            className="hidden items-center gap-2 text-[10.5px] text-muted sm:flex"
            aria-hidden="true"
          >
            <span className="inline-flex items-center gap-1">
              <span className="inline-block size-2 rounded-full border border-dashed border-brand" />
              Today
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block size-2 rounded-full bg-brand" />
              Surgery, prepared
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block size-2 rounded-full bg-act-fill" />
              Readiness issue
            </span>
          </div>

          <div className="inline-flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => setAnchorMonday((m) => addDays(m, -14))}
              aria-label="Previous two weeks"
              className="grid size-6 place-items-center rounded-full text-ink-secondary hover:bg-hover hover:text-ink"
            >
              <ChevronLeft className="size-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setAnchorMonday((m) => addDays(m, 14))}
              aria-label="Next two weeks"
              className="grid size-6 place-items-center rounded-full text-ink-secondary hover:bg-hover hover:text-ink"
            >
              <ChevronRight className="size-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      <CalendarWeekGrid
        weeks={weeks}
        selectedDate={selectedDate}
        onSelectDate={onSelectDate}
        compact={true}
      />
    </div>
  );
}

/**
 * Full Month / 2-Week interactive calendar for expanded focus workspaces
 * (`#/focus/readiness` and `#/focus/checkins`).
 */
export function ExpandedClinicalCalendar({
  eventMap,
  selectedDate,
  onSelectDate,
  lens,
  onOpenPatient,
}: {
  eventMap: Map<string, CalendarDayData>;
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
  lens: CalendarLens;
  onOpenPatient: (id: string) => void;
}) {
  const initialRef = selectedDate ? parseDate(selectedDate) : parseDate(DEMO_DATE);
  const [mode, setMode] = useState<"month" | "twoweek">("month");
  const [viewYear, setViewYear] = useState(initialRef.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialRef.getMonth());
  const [anchorMonday, setAnchorMonday] = useState(() =>
    startOfMondayWeek(selectedDate ?? DEMO_DATE),
  );

  const weeks =
    mode === "month"
      ? buildMonthGrid(viewYear, viewMonth, eventMap, lens)
      : buildTwoWeekGrid(anchorMonday, eventMap, lens);

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString(
    "en-US",
    { month: "long", year: "numeric" },
  );

  const stepPeriod = (dir: -1 | 1) => {
    if (mode === "month") {
      const next = new Date(viewYear, viewMonth + dir, 1);
      setViewYear(next.getFullYear());
      setViewMonth(next.getMonth());
    } else {
      setAnchorMonday((m) => addDays(m, dir * 14));
    }
  };

  const jumpToDemoToday = () => {
    const d = parseDate(DEMO_DATE);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    setAnchorMonday(startOfMondayWeek(DEMO_DATE));
    onSelectDate(null);
  };

  const selectedData = selectedDate ? eventMap.get(selectedDate) : undefined;
  const demoParsed = parseDate(DEMO_DATE);
  const isDefaultPeriod =
    mode === "month"
      ? viewYear === demoParsed.getFullYear() &&
        viewMonth === demoParsed.getMonth()
      : anchorMonday === startOfMondayWeek(DEMO_DATE);

  return (
    <div className="space-y-3 border-b border-line pb-4 lg:border-r lg:border-b-0 lg:pr-5 lg:pb-0">
      <div className="flex items-center justify-between gap-2">
        <SegmentedControl
          label="Calendar view mode"
          value={mode}
          onChange={setMode}
          options={[
            { id: "month", label: "Month" },
            { id: "twoweek", label: "2 weeks" },
          ]}
        />
        {selectedDate !== null || !isDefaultPeriod ? (
          <button
            type="button"
            onClick={jumpToDemoToday}
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-select-tonal px-2.5 py-1 text-[11.5px] font-semibold whitespace-nowrap text-select-ink hover:brightness-95"
          >
            <RotateCcw className="size-3" aria-hidden="true" />
            <span>Today</span>
          </button>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-2 pt-1">
        <h3 className="text-[15px] font-semibold text-ink">
          {mode === "month" ? monthLabel : formatTwoWeekRange(anchorMonday)}
        </h3>
        <div className="inline-flex items-center gap-1">
          <button
            type="button"
            onClick={() => stepPeriod(-1)}
            aria-label={mode === "month" ? "Previous month" : "Previous two weeks"}
            className="grid size-7 place-items-center rounded-full text-ink-secondary hover:bg-hover hover:text-ink"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => stepPeriod(1)}
            aria-label={mode === "month" ? "Next month" : "Next two weeks"}
            className="grid size-7 place-items-center rounded-full text-ink-secondary hover:bg-hover hover:text-ink"
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <CalendarWeekGrid
        weeks={weeks}
        selectedDate={selectedDate}
        onSelectDate={onSelectDate}
        compact={false}
      />

      {/* Clinical calendar legend */}
      <div className="space-y-1.5 border-t border-line pt-2.5 text-[11.5px] text-muted">
        {lens === "schedule" ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-4 rounded-full bg-brand-tonal" />
              7-day pre-op window
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block size-2.5 rounded-full bg-brand" />
              Surgery ready
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block size-2.5 rounded-full bg-act-fill" />
              Readiness gap
            </span>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-4 rounded-full bg-select-tonal/70" />
              Active check-in sequence
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block size-2 rounded-full bg-act-fill" />
              Urgent
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block size-2 rounded-full bg-watch-fill" />
              Watch / missed
            </span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-full border border-dashed border-brand" />
          <span>Demo reference date: Sat, Nov 7, 2026</span>
        </div>
      </div>

      {/* Selected date summary panel */}
      <div className="border-t border-line pt-2.5">
        {selectedDate ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12.5px] font-semibold text-ink">
                {fmtDate(selectedDate)} · {relDays(selectedDate)}
              </span>
              <button
                type="button"
                onClick={() => onSelectDate(null)}
                className="text-[11.5px] font-semibold text-brand hover:underline"
              >
                Show all dates
              </button>
            </div>

            {!selectedData ||
            (selectedData.surgeries.length === 0 &&
              selectedData.checkIns.length === 0) ? (
              <p className="text-[12.5px] text-muted">
                No scheduled procedures or recorded check-ins on this date.
              </p>
            ) : (
              <div className="space-y-2">
                {selectedData.surgeries.map((s) => (
                  <div
                    key={s.patientId}
                    className="border-l-2 border-l-brand pl-2.5 text-[12.5px]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => onOpenPatient(s.patientId)}
                        className="font-semibold text-ink hover:text-brand hover:underline"
                      >
                        {s.patientName}
                      </button>
                      <StatusPill status={s.status} />
                    </div>
                    <div className="text-muted">
                      {s.procedure} · {s.site}
                    </div>
                    <div
                      className={
                        s.missingLabels.length > 0
                          ? "font-medium text-act"
                          : "text-ok"
                      }
                    >
                      {s.missingLabels.length > 0
                        ? `Missing: ${s.missingLabels.join(", ")}`
                        : `${s.readyCount}/${s.totalCount} due items confirmed`}
                    </div>
                  </div>
                ))}

                {selectedData.checkIns.map((ci) => (
                  <div
                    key={ci.checkIn.id}
                    className="border-l-2 border-l-line-strong pl-2.5 text-[12px]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => onOpenPatient(ci.patient.id)}
                        className="font-semibold text-ink hover:text-brand hover:underline"
                      >
                        {ci.patient.name}
                      </button>
                      <span className="text-muted">
                        {CHANNEL_LABEL[ci.checkIn.channel]}
                      </span>
                    </div>
                    <div className="text-ink-secondary">{ci.headline}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="text-[12px] text-muted">
            Select any calendar date to filter {lens === "schedule" ? "procedures" : "check-in events"} to that day.
          </p>
        )}
      </div>
    </div>
  );
}
