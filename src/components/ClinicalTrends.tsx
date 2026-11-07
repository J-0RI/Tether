import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  Table2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { fmtDate } from "../lib/dates";
import {
  computePatientTrends,
  type MetricKey,
  type TrendObservation,
} from "../lib/derive";
import type { Mood, Patient } from "../types";

export function ClinicalTrends({ patient: p }: { patient: Patient }) {
  const trends = useMemo(() => computePatientTrends(p), [p]);
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>(
    () => trends.primaryMetric,
  );
  const [chartExpanded, setChartExpanded] = useState(true);
  const [showTable, setShowTable] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(() =>
    Math.max(0, trends.observations.length - 1),
  );

  const safeIndex = Math.min(
    activeIndex,
    Math.max(0, trends.observations.length - 1),
  );
  const activeObs: TrendObservation | undefined =
    trends.observations[safeIndex];

  const selectMetric = (m: MetricKey) => {
    setSelectedMetric(m);
    if (!chartExpanded) setChartExpanded(true);
  };

  return (
    <section aria-labelledby="patient-trends-heading">
      <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 id="patient-trends-heading">Patient-reported clinical trends</h2>
          <p className="mt-0.5 text-[12.5px] text-muted">
            Compared against referral baseline · {trends.answeredCount} answered
            check-ins
            {trends.missedCount > 0
              ? ` · ${trends.missedCount} unanswered`
              : ""}
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            aria-expanded={showTable}
            onClick={() => setShowTable((v) => !v)}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold transition-colors ${
              showTable
                ? "bg-select-tonal text-select-ink"
                : "bg-track text-ink-secondary hover:text-ink"
            }`}
          >
            <Table2 className="size-3.5" aria-hidden="true" />
            <span>{showTable ? "Hide table" : "Values table"}</span>
          </button>

          <button
            type="button"
            aria-expanded={chartExpanded}
            onClick={() => setChartExpanded((v) => !v)}
            className="inline-flex items-center gap-1 rounded-full bg-track px-2.5 py-1 text-[12px] font-semibold text-ink-secondary hover:bg-select-tonal hover:text-select-ink"
          >
            <span>{chartExpanded ? "Collapse chart" : "Expand chart"}</span>
            {chartExpanded ? (
              <ChevronUp className="size-3.5" aria-hidden="true" />
            ) : (
              <ChevronDown className="size-3.5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* Compact Prioritized Summary Strip */}
      <div
        role="group"
        aria-label="Select clinical metric to inspect longitudinal history"
        className="grid grid-cols-1 gap-2 sm:grid-cols-3"
      >
        {/* Pain Summary Tile */}
        <TrendSummaryTile
          active={chartExpanded && selectedMetric === "pain"}
          flagged={trends.pain.flagged}
          title="Pain (0–10)"
          value={
            trends.pain.current !== null ? `${trends.pain.current}` : "—"
          }
          unit={trends.pain.current !== null ? "/10" : ""}
          badge={
            trends.pain.delta === null
              ? "No reply"
              : trends.pain.delta === 0
                ? "±0 vs base"
                : `${trends.pain.delta > 0 ? "+" : ""}${trends.pain.delta} vs base`
          }
          badgeTone={
            trends.pain.flagged
              ? "watch"
              : trends.pain.delta !== null && trends.pain.delta < 0
                ? "ok"
                : "neutral"
          }
          direction={
            trends.pain.direction === "up"
              ? "worse-up"
              : trends.pain.direction === "down"
                ? "better-down"
                : "flat"
          }
          headline={trends.pain.headline}
          subline={`Baseline ${trends.pain.baseline}/10`}
          onClick={() => selectMetric("pain")}
        />

        {/* Walking Summary Tile */}
        <TrendSummaryTile
          active={chartExpanded && selectedMetric === "walk"}
          flagged={trends.walk.flagged}
          title="Walking (15+ min)"
          value={
            trends.walk.current !== null ? `${trends.walk.current}` : "—"
          }
          unit={trends.walk.current !== null ? " days/wk" : ""}
          badge={
            trends.walk.delta === null
              ? "No reply"
              : trends.walk.delta === 0
                ? "±0 vs base"
                : `${trends.walk.delta > 0 ? "+" : ""}${trends.walk.delta}d vs base`
          }
          badgeTone={
            trends.walk.flagged
              ? "watch"
              : trends.walk.delta !== null && trends.walk.delta > 0
                ? "ok"
                : "neutral"
          }
          direction={
            trends.walk.direction === "down"
              ? "worse-down"
              : trends.walk.direction === "up"
                ? "better-up"
                : "flat"
          }
          headline={trends.walk.headline}
          subline={`Baseline ${trends.walk.baseline} days/wk`}
          onClick={() => selectMetric("walk")}
        />

        {/* Categorical Mood Summary Tile */}
        <TrendSummaryTile
          active={chartExpanded && selectedMetric === "mood"}
          flagged={trends.mood.flagged}
          title="Mood (categorical)"
          value={trends.mood.current ?? "—"}
          unit=""
          badge={
            trends.mood.flagged
              ? `${trends.mood.consecutiveLow}× Low`
              : `Base: ${trends.mood.baseline}`
          }
          badgeTone={trends.mood.flagged ? "mood" : "neutral"}
          direction="categorical"
          headline={trends.mood.headline}
          subline="Good · Okay · Low"
          onClick={() => selectMetric("mood")}
        />
      </div>

      {/* Focused Single-Metric Longitudinal Chart */}
      {chartExpanded && trends.observations.length > 0 ? (
        <div className="mt-3 rounded-xl border border-line bg-white p-3.5">
          {/* Interactive Observation Readout Header */}
          <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2">
            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 text-[12.5px]">
              <span className="font-semibold text-ink">
                {selectedMetric === "pain"
                  ? "Pain severity trajectory (0–10)"
                  : selectedMetric === "walk"
                    ? "Weekly walking frequency (0–7 days/week · 15+ min)"
                    : "Categorical mood progression (Good / Okay / Low)"}
              </span>
              <span className="text-muted">·</span>
              <span className="text-muted">
                {selectedMetric === "pain"
                  ? `Watch threshold: ≥ ${Math.min(10, p.baseline.pain + 2)}/10 (+2 above baseline ${p.baseline.pain})`
                  : selectedMetric === "walk"
                    ? `Watch threshold: ≤ ${Math.max(0, p.baseline.walk - 3)} days/wk (−3 below baseline ${p.baseline.walk})`
                    : `Watch threshold: 2 consecutive Low check-ins`}
              </span>
            </div>

            {activeObs ? (
              <div className="inline-flex flex-wrap items-center gap-2 rounded-full bg-track px-2.5 py-0.5 text-[12px]">
                <strong className="font-semibold text-ink">
                  {fmtDate(activeObs.date, { year: false })}
                </strong>
                {activeObs.missed ? (
                  <span className="font-semibold text-watch">
                    No response recorded
                  </span>
                ) : selectedMetric === "pain" ? (
                  <span className="text-ink-secondary">
                    Pain <strong>{activeObs.pain}/10</strong>
                    {activeObs.rawPain ? ` · “${activeObs.rawPain}”` : ""}
                  </span>
                ) : selectedMetric === "walk" ? (
                  <span className="text-ink-secondary">
                    Walked <strong>{activeObs.walk} days/wk</strong>
                    {activeObs.rawWalk ? ` · “${activeObs.rawWalk}”` : ""}
                  </span>
                ) : (
                  <span className="text-ink-secondary">
                    Mood <strong>{activeObs.mood}</strong>
                    {activeObs.rawMood ? ` · “${activeObs.rawMood}”` : ""}
                  </span>
                )}
              </div>
            ) : null}
          </div>

          {selectedMetric === "pain" ? (
            <PainLongitudinalSvg
              observations={trends.observations}
              baseline={p.baseline.pain}
              activeIndex={safeIndex}
              onSelectIndex={setActiveIndex}
            />
          ) : selectedMetric === "walk" ? (
            <WalkLongitudinalSvg
              observations={trends.observations}
              baseline={p.baseline.walk}
              activeIndex={safeIndex}
              onSelectIndex={setActiveIndex}
            />
          ) : (
            <MoodCategoricalSvg
              observations={trends.observations}
              baseline={p.baseline.mood}
              activeIndex={safeIndex}
              onSelectIndex={setActiveIndex}
            />
          )}
        </div>
      ) : null}

      {/* Accessible Tabular Alternative */}
      {showTable ? (
        <div className="mt-3 clinical-table-wrap">
          <table className="clinical-table">
            <caption className="visually-hidden">
              Chronological check-in measurements for {p.name}
            </caption>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Pain (0–10)</th>
                <th scope="col">Walking (days/wk)</th>
                <th scope="col">Mood</th>
                <th scope="col">Notes / flags</th>
              </tr>
            </thead>
            <tbody>
              {[...trends.observations].reverse().map((obs) => (
                <tr key={obs.id}>
                  <td className="whitespace-nowrap font-medium">
                    {fmtDate(obs.date)}
                  </td>
                  <td>
                    {obs.missed ? (
                      <span className="text-muted">Missed</span>
                    ) : (
                      <span
                        className={
                          obs.painFlagged ? "font-semibold text-watch" : ""
                        }
                      >
                        {obs.pain}/10
                      </span>
                    )}
                  </td>
                  <td>
                    {obs.missed ? (
                      <span className="text-muted">Missed</span>
                    ) : (
                      <span
                        className={
                          obs.walkFlagged ? "font-semibold text-watch" : ""
                        }
                      >
                        {obs.walk} days/wk
                      </span>
                    )}
                  </td>
                  <td>
                    {obs.missed ? (
                      <span className="text-muted">Missed</span>
                    ) : (
                      <span
                        className={
                          obs.consecutiveLowGroup
                            ? "font-semibold text-mood-low"
                            : ""
                        }
                      >
                        {obs.mood}
                      </span>
                    )}
                  </td>
                  <td className="text-[12px] text-muted">
                    {obs.redFlag
                      ? `Red flag: ${obs.redFlag}`
                      : obs.note
                        ? `“${obs.note}”`
                        : obs.rawPain || obs.rawWalk || obs.rawMood
                          ? `“${obs.rawPain ?? obs.rawWalk ?? obs.rawMood}”`
                          : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

function TrendSummaryTile({
  active,
  flagged,
  title,
  value,
  unit,
  badge,
  badgeTone,
  direction,
  headline,
  subline,
  onClick,
}: {
  active: boolean;
  flagged: boolean;
  title: string;
  value: string;
  unit: string;
  badge: string;
  badgeTone: "watch" | "ok" | "mood" | "neutral";
  direction:
    | "worse-up"
    | "worse-down"
    | "better-down"
    | "better-up"
    | "flat"
    | "categorical";
  headline: string;
  subline: string;
  onClick: () => void;
}) {
  const badgeCls = {
    watch: "bg-watch-bg text-watch",
    ok: "bg-ok-bg text-ok",
    mood: "bg-mood-low-bg text-mood-low",
    neutral: "bg-track text-ink-secondary",
  }[badgeTone];

  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`flex flex-col justify-between rounded-xl border p-3 text-left transition-colors ${
        active
          ? "border-brand bg-brand-tonal/30 ring-1 ring-brand"
          : flagged
            ? "border-watch-line bg-watch-bg/25 hover:bg-watch-bg/40"
            : "border-line bg-white hover:bg-hover"
      }`}
    >
      <div className="flex w-full items-center justify-between gap-2">
        <span className="text-[12px] font-semibold text-ink-secondary">
          {title}
        </span>
        <span
          className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${badgeCls}`}
        >
          {direction === "worse-up" || direction === "better-up" ? (
            <ArrowUpRight className="size-3" aria-hidden="true" />
          ) : direction === "worse-down" || direction === "better-down" ? (
            <ArrowDownRight className="size-3" aria-hidden="true" />
          ) : direction === "flat" ? (
            <ArrowRight className="size-3" aria-hidden="true" />
          ) : null}
          {badge}
        </span>
      </div>

      <div className="mt-1.5 flex items-baseline gap-1">
        <strong
          className={`tabular text-[24px] leading-none font-bold tracking-[-0.025em] ${
            flagged
              ? badgeTone === "mood"
                ? "text-mood-low"
                : "text-watch"
              : "text-ink"
          }`}
        >
          {value}
        </strong>
        {unit ? (
          <span className="text-[12.5px] font-medium text-muted">{unit}</span>
        ) : null}
      </div>

      <div className="mt-1.5">
        <div className="text-[12.5px] font-medium text-ink">{headline}</div>
        <div className="text-[11.5px] text-muted">{subline}</div>
      </div>
    </button>
  );
}

/* ---- 1. Pain Longitudinal Visualization (0–10 scale) ---- */
function PainLongitudinalSvg({
  observations,
  baseline,
  activeIndex,
  onSelectIndex,
}: {
  observations: TrendObservation[];
  baseline: number;
  activeIndex: number;
  onSelectIndex: (idx: number) => void;
}) {
  const W = 680;
  const H = 172;
  const padL = 36;
  const padR = 74;
  const padT = 14;
  const padB = 32;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const count = observations.length;
  const xAt = (i: number) =>
    count <= 1 ? padL + plotW / 2 : padL + (i / (count - 1)) * plotW;
  const yAt = (val: number) => padT + ((10 - val) / 10) * plotH;

  const watchThreshold = Math.min(10, baseline + 2);
  const ticks = [0, 2, 4, 6, 8, 10];

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full select-none"
        role="img"
        aria-label={`Pain score progression from 0 to 10 across ${count} check-ins. Referral baseline is ${baseline}/10.`}
      >
        {/* Subtle Watch threshold zone */}
        {watchThreshold < 10 ? (
          <rect
            x={padL}
            y={yAt(10)}
            width={plotW}
            height={yAt(watchThreshold) - yAt(10)}
            rx={6}
            fill="#fef3c7"
            fillOpacity={0.32}
          />
        ) : null}

        {/* Minimal horizontal scale guides */}
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={padL}
              x2={W - padR}
              y1={yAt(t)}
              y2={yAt(t)}
              stroke={t === 0 ? "#cbd5e1" : "#f1f5f9"}
              strokeWidth={1}
            />
            <text
              x={padL - 8}
              y={yAt(t) + 3.5}
              textAnchor="end"
              fontSize={10.5}
              fill="#526071"
            >
              {t}
            </text>
          </g>
        ))}

        {/* Referral baseline reference line */}
        <line
          x1={padL}
          x2={W - padR + 8}
          y1={yAt(baseline)}
          y2={yAt(baseline)}
          stroke="#64748b"
          strokeWidth={1.25}
          strokeDasharray="4 4"
        />
        <text
          x={W - padR + 12}
          y={yAt(baseline) + 3.5}
          textAnchor="start"
          fontSize={10}
          fontWeight={600}
          fill="#475569"
        >
          Base {baseline}/10
        </text>

        {/* Threshold-aware line segments (gaps break cleanly on missed check-ins) */}
        {observations.map((obs, i) => {
          if (i === 0) return null;
          const prev = observations[i - 1];
          if (obs.missed || prev.missed || obs.pain === null || prev.pain === null) {
            return null;
          }
          const segmentFlagged = obs.painFlagged || prev.painFlagged;
          return (
            <line
              key={`seg-${obs.id}`}
              x1={xAt(i - 1)}
              y1={yAt(prev.pain)}
              x2={xAt(i)}
              y2={yAt(obs.pain)}
              stroke={segmentFlagged ? "#d97706" : "#0b7a8e"}
              strokeWidth={2.8}
              strokeLinecap="round"
            />
          );
        })}

        {/* Data nodes & X-axis date capsules */}
        {observations.map((obs, i) => {
          const cx = xAt(i);
          const selected = i === activeIndex;
          const showLabel =
            count <= 8 || i === 0 || i === count - 1 || i % 2 === 1 || selected;
          const shortDate = parseShortLabel(obs.date);

          return (
            <g
              key={obs.id}
              onClick={() => onSelectIndex(i)}
              onMouseEnter={() => onSelectIndex(i)}
              className="cursor-pointer"
            >
              {/* Invisible wider hit column */}
              <rect
                x={cx - 18}
                y={padT}
                width={36}
                height={H - padT}
                fill="transparent"
              />

              {/* Selected date pill on X-axis (Google Health M3 Expressive pattern) */}
              {selected ? (
                <rect
                  x={cx - 23}
                  y={H - 22}
                  width={46}
                  height={18}
                  rx={9}
                  fill={obs.painFlagged ? "#fef3c7" : "#d3e3fd"}
                />
              ) : null}

              {showLabel ? (
                <text
                  x={cx}
                  y={H - 9.5}
                  textAnchor="middle"
                  fontSize={10.5}
                  fontWeight={selected ? 700 : 500}
                  fill={
                    selected
                      ? obs.painFlagged
                        ? "#854d0e"
                        : "#041e49"
                      : "#526071"
                  }
                >
                  {shortDate}
                </text>
              ) : null}

              {obs.missed || obs.pain === null ? (
                <g transform={`translate(${cx}, ${yAt(baseline)})`}>
                  <circle
                    r={5}
                    fill="#ffffff"
                    stroke="#94a3b8"
                    strokeWidth={1.5}
                    strokeDasharray="2 2"
                  />
                </g>
              ) : (
                <g>
                  {selected ? (
                    <circle
                      cx={cx}
                      cy={yAt(obs.pain)}
                      r={8.5}
                      fill={obs.painFlagged ? "#fef3c7" : "#def1f2"}
                    />
                  ) : null}
                  <circle
                    cx={cx}
                    cy={yAt(obs.pain)}
                    r={selected ? 5.2 : 4.4}
                    fill={obs.painFlagged ? "#d97706" : "#0b7a8e"}
                    stroke="#ffffff"
                    strokeWidth={1.8}
                  />
                </g>
              )}
            </g>
          );
        })}
      </svg>

      <ChartFooterLegend
        left="Teal: within baseline · Amber: +2 pts or more above baseline (Watch)"
        right="Click or hover any check-in date to inspect response"
      />
    </div>
  );
}

/* ---- 2. Walking Frequency Visualization (0–7 days/week) ---- */
function WalkLongitudinalSvg({
  observations,
  baseline,
  activeIndex,
  onSelectIndex,
}: {
  observations: TrendObservation[];
  baseline: number;
  activeIndex: number;
  onSelectIndex: (idx: number) => void;
}) {
  const W = 680;
  const H = 172;
  const padL = 36;
  const padR = 74;
  const padT = 14;
  const padB = 32;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const count = observations.length;
  const slotW = plotW / Math.max(1, count);
  const barW = Math.min(26, Math.max(14, slotW * 0.46));
  const xCenter = (i: number) => padL + slotW * i + slotW / 2;
  const yAt = (days: number) => padT + ((7 - days) / 7) * plotH;

  const ticks = [0, 2, 4, 7];

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full select-none"
        role="img"
        aria-label={`Weekly walking frequency from 0 to 7 days per week across ${count} check-ins. Baseline is ${baseline} days per week.`}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={padL}
              x2={W - padR}
              y1={yAt(t)}
              y2={yAt(t)}
              stroke={t === 0 ? "#cbd5e1" : "#f1f5f9"}
              strokeWidth={1}
            />
            <text
              x={padL - 8}
              y={yAt(t) + 3.5}
              textAnchor="end"
              fontSize={10.5}
              fill="#526071"
            >
              {t}d
            </text>
          </g>
        ))}

        {/* Capsule columns inside 7-day tracks */}
        {observations.map((obs, i) => {
          const cx = xCenter(i);
          const selected = i === activeIndex;
          const shortDate = parseShortLabel(obs.date);
          const showLabel =
            count <= 8 || i === 0 || i === count - 1 || i % 2 === 1 || selected;

          const fillH =
            !obs.missed && obs.walk !== null
              ? Math.max(0, yAt(0) - yAt(obs.walk))
              : 0;

          return (
            <g
              key={obs.id}
              onClick={() => onSelectIndex(i)}
              onMouseEnter={() => onSelectIndex(i)}
              className="cursor-pointer"
            >
              {/* Full 7-day background capsule track */}
              <rect
                x={cx - barW / 2}
                y={yAt(7)}
                width={barW}
                height={plotH}
                rx={barW / 2}
                fill={selected ? "#e2e8f0" : "#f1f4f8"}
              />

              {obs.missed || obs.walk === null ? (
                <text
                  x={cx}
                  y={yAt(3.5)}
                  textAnchor="middle"
                  fontSize={9.5}
                  fontWeight={600}
                  fill="#64748b"
                >
                  —
                </text>
              ) : obs.walk === 0 ? (
                /* Explicit zero-days capsule marker */
                <g>
                  <rect
                    x={cx - barW / 2}
                    y={yAt(0) - 14}
                    width={barW}
                    height={14}
                    rx={7}
                    fill={obs.walkFlagged ? "#d97706" : "#64748b"}
                  />
                  <text
                    x={cx}
                    y={yAt(0) - 4}
                    textAnchor="middle"
                    fontSize={9.5}
                    fontWeight={700}
                    fill="#ffffff"
                  >
                    0d
                  </text>
                </g>
              ) : (
                <rect
                  x={cx - barW / 2}
                  y={yAt(obs.walk)}
                  width={barW}
                  height={Math.max(10, fillH)}
                  rx={Math.min(barW / 2, Math.max(5, fillH / 2))}
                  fill={obs.walkFlagged ? "#d97706" : "#0e847a"}
                />
              )}

              {selected ? (
                <rect
                  x={cx - 23}
                  y={H - 22}
                  width={46}
                  height={18}
                  rx={9}
                  fill={obs.walkFlagged ? "#fef3c7" : "#d3e3fd"}
                />
              ) : null}

              {showLabel ? (
                <text
                  x={cx}
                  y={H - 9.5}
                  textAnchor="middle"
                  fontSize={10.5}
                  fontWeight={selected ? 700 : 500}
                  fill={
                    selected
                      ? obs.walkFlagged
                        ? "#854d0e"
                        : "#041e49"
                      : "#526071"
                  }
                >
                  {shortDate}
                </text>
              ) : null}
            </g>
          );
        })}

        {/* Baseline reference line rendered over tracks */}
        <line
          x1={padL}
          x2={W - padR + 6}
          y1={yAt(baseline)}
          y2={yAt(baseline)}
          stroke="#334155"
          strokeWidth={1.3}
          strokeDasharray="4 4"
        />
        <text
          x={W - padR + 10}
          y={yAt(baseline) + 3.5}
          textAnchor="start"
          fontSize={10}
          fontWeight={600}
          fill="#334155"
        >
          Base {baseline}d/wk
        </text>
      </svg>

      <ChartFooterLegend
        left="Teal capsule: active days/week (0–7) · Amber: down 3+ days/wk from baseline"
        right="15+ minutes per walk · not total minutes"
      />
    </div>
  );
}

/* ---- 3. Categorical Mood Swimlane (Google Health Sleep-Track + Connected State Capsules) ---- */
function MoodCategoricalSvg({
  observations,
  baseline,
  activeIndex,
  onSelectIndex,
}: {
  observations: TrendObservation[];
  baseline: Mood;
  activeIndex: number;
  onSelectIndex: (idx: number) => void;
}) {
  const W = 680;
  const H = 166;
  const padL = 56;
  const padR = 22;
  const plotW = W - padL - padR;

  const lanes: { mood: Mood; y: number }[] = [
    { mood: "Good", y: 30 },
    { mood: "Okay", y: 74 },
    { mood: "Low", y: 118 },
  ];
  const laneY = (m: Mood) => lanes.find((l) => l.mood === m)!.y;

  const count = observations.length;
  const slotW = plotW / Math.max(1, count);
  const xCenter = (i: number) => padL + slotW * i + slotW / 2;

  // Build connected capsule spans for consecutive Low check-ins (like Cycle Health connected capsules)
  const consecutiveSpans: { startIdx: number; endIdx: number }[] = [];
  let runStart: number | null = null;
  let lastAnsweredIdx: number | null = null;
  observations.forEach((obs, i) => {
    if (obs.missed || !obs.mood) return;
    if (obs.mood === "Low") {
      if (runStart === null) runStart = i;
      lastAnsweredIdx = i;
    } else {
      if (runStart !== null && lastAnsweredIdx !== null && lastAnsweredIdx > runStart) {
        consecutiveSpans.push({ startIdx: runStart, endIdx: lastAnsweredIdx });
      }
      runStart = null;
      lastAnsweredIdx = null;
    }
  });
  if (runStart !== null && lastAnsweredIdx !== null && lastAnsweredIdx > runStart) {
    consecutiveSpans.push({ startIdx: runStart, endIdx: lastAnsweredIdx });
  }

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full select-none"
        role="img"
        aria-label={`Categorical mood timeline across ${count} check-ins. Categories: Good, Okay, Low. Baseline mood: ${baseline}.`}
      >
        {/* Horizontal categorical pill tracks (Google Health sleep-track geometry) */}
        {lanes.map((lane) => (
          <g key={lane.mood}>
            <rect
              x={padL}
              y={lane.y - 11}
              width={plotW}
              height={22}
              rx={11}
              fill={lane.mood === "Low" ? "#faf5ff" : "#f3f5f9"}
            />
            <text
              x={padL - 10}
              y={lane.y + 4}
              textAnchor="end"
              fontSize={11.5}
              fontWeight={lane.mood === baseline ? 700 : 550}
              fill={lane.mood === "Low" ? "#6d3b9e" : "#334155"}
            >
              {lane.mood}
            </text>
          </g>
        ))}

        {/* Connected halo capsules around consecutive Low mood reports */}
        {consecutiveSpans.map((span) => {
          const x1 = xCenter(span.startIdx) - 16;
          const x2 = xCenter(span.endIdx) + 16;
          return (
            <rect
              key={`low-span-${span.startIdx}`}
              x={x1}
              y={laneY("Low") - 15}
              width={x2 - x1}
              height={30}
              rx={15}
              fill="#f3e8ff"
              stroke="#c084fc"
              strokeWidth={1.4}
            />
          );
        })}

        {/* Vertical transition connectors between consecutive answered states */}
        {observations.map((obs, i) => {
          if (i === 0) return null;
          const prev = observations[i - 1];
          if (obs.missed || prev.missed || !obs.mood || !prev.mood) return null;
          const x1 = xCenter(i - 1);
          const y1 = laneY(prev.mood);
          const x2 = xCenter(i);
          const y2 = laneY(obs.mood);
          const midX = (x1 + x2) / 2;

          return (
            <path
              key={`conn-${obs.id}`}
              d={`M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`}
              fill="none"
              stroke={
                obs.mood === "Low" && prev.mood === "Low"
                  ? "#7c3aed"
                  : "#cbd5e1"
              }
              strokeWidth={1.6}
            />
          );
        })}

        {/* Individual categorical state pills */}
        {observations.map((obs, i) => {
          const cx = xCenter(i);
          const selected = i === activeIndex;
          const shortDate = parseShortLabel(obs.date);
          const showLabel =
            count <= 8 || i === 0 || i === count - 1 || i % 2 === 1 || selected;

          return (
            <g
              key={obs.id}
              onClick={() => onSelectIndex(i)}
              onMouseEnter={() => onSelectIndex(i)}
              className="cursor-pointer"
            >
              <rect
                x={cx - slotW / 2}
                y={12}
                width={slotW}
                height={H - 12}
                fill="transparent"
              />

              {obs.missed || !obs.mood ? (
                <circle
                  cx={cx}
                  cy={laneY(baseline)}
                  r={5}
                  fill="#ffffff"
                  stroke="#94a3b8"
                  strokeWidth={1.5}
                  strokeDasharray="2 2"
                />
              ) : obs.mood === "Good" ? (
                <rect
                  x={cx - 11}
                  y={laneY("Good") - 8}
                  width={22}
                  height={16}
                  rx={8}
                  fill="#0e7c86"
                  stroke={selected ? "#041e49" : "#ffffff"}
                  strokeWidth={selected ? 2 : 1.5}
                />
              ) : obs.mood === "Okay" ? (
                <rect
                  x={cx - 11}
                  y={laneY("Okay") - 8}
                  width={22}
                  height={16}
                  rx={8}
                  fill="#e2e8f0"
                  stroke={selected ? "#041e49" : "#475569"}
                  strokeWidth={selected ? 2 : 1.5}
                />
              ) : (
                <g>
                  <rect
                    x={cx - 12}
                    y={laneY("Low") - 9}
                    width={24}
                    height={18}
                    rx={9}
                    fill="#6d3b9e"
                    stroke={selected ? "#041e49" : "#ffffff"}
                    strokeWidth={selected ? 2 : 1.5}
                  />
                  <circle cx={cx} cy={laneY("Low")} r={2.5} fill="#ffffff" />
                </g>
              )}

              {selected ? (
                <rect
                  x={cx - 23}
                  y={H - 21}
                  width={46}
                  height={18}
                  rx={9}
                  fill={obs.consecutiveLowGroup ? "#f3e8ff" : "#d3e3fd"}
                />
              ) : null}

              {showLabel ? (
                <text
                  x={cx}
                  y={H - 8.5}
                  textAnchor="middle"
                  fontSize={10.5}
                  fontWeight={selected ? 700 : 500}
                  fill={
                    selected
                      ? obs.consecutiveLowGroup
                        ? "#6d3b9e"
                        : "#041e49"
                      : "#526071"
                  }
                >
                  {shortDate}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>

      <ChartFooterLegend
        left={`Baseline mood: ${baseline} · Connected violet capsule highlights consecutive Low check-ins`}
        right="Categorical states (no artificial numeric averaging)"
      />
    </div>
  );
}

function ChartFooterLegend({ left, right }: { left: string; right: string }) {
  return (
    <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[11.5px] text-muted">
      <span>{left}</span>
      <span>{right}</span>
    </div>
  );
}

function parseShortLabel(dateStr: string): string {
  const [, m, d] = dateStr.split("-").map(Number);
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${months[(m || 1) - 1]} ${d}`;
}
