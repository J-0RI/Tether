import { useLayoutEffect, useRef, useState } from "react";
import { fmtDate, parseDate } from "../../lib/dates";
import type { TrendObservation } from "../../lib/derive";
import type { Mood } from "../../types";

const C = {
  brand: "#0b6168",
  watch: "#d97706",
  watchInk: "#854d0e",
  act: "#d9382c",
  grid: "#e2e8f0",
  axis: "#526071",
  baseline: "#334155",
  select: "#0b57d0",
  missed: "#94a3b8",
  moodLow: "#6d3b9e",
  moodOkay: "#94a3b8",
  moodGood: "#158466",
};

export const MOOD_COLOR: Record<Mood, string> = {
  Low: C.moodLow,
  Okay: C.moodOkay,
  Good: C.moodGood,
};


function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth);
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

/** x positions by actual date, so uneven gaps (e.g. a same-day simulated check-in) stay honest. */
function xScale(obs: TrendObservation[], x0: number, x1: number) {
  const t = obs.map((o) => parseDate(o.date).getTime());
  const min = Math.min(...t);
  const max = Math.max(...t);
  const span = max - min || 1;
  return (i: number) => (obs.length === 1 ? (x0 + x1) / 2 : x0 + ((t[i] - min) / span) * (x1 - x0));
}

/** Indices of consecutive answered observations, so missed check-ins break the line. */
function segments(obs: TrendObservation[], val: (o: TrendObservation) => number | null): number[][] {
  const out: number[][] = [];
  let cur: number[] = [];
  obs.forEach((o, i) => {
    if (val(o) === null) {
      if (cur.length) out.push(cur);
      cur = [];
    } else cur.push(i);
  });
  if (cur.length) out.push(cur);
  return out;
}

/* ------------------------------------------------------------------ */
/* Full charts (expanded on request)                                   */
/* ------------------------------------------------------------------ */

interface FullChartProps {
  obs: TrendObservation[];
  baseline: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const PAD = { l: 34, r: 76, t: 14, b: 28 };

function XLabels({ obs, x, h, selectedId }: { obs: TrendObservation[]; x: (i: number) => number; h: number; selectedId: string | null }) {
  const sel = obs.findIndex((o) => o.id === selectedId);
  const idx = [...new Set([0, obs.length - 1, sel].filter((i) => i >= 0))];
  return (
    <>
      {idx.map((i) => (
        <text
          key={i}
          x={x(i)}
          y={h - 8}
          textAnchor={i === 0 ? "start" : i === obs.length - 1 && i !== sel ? "end" : "middle"}
          fontSize={11.5}
          fontWeight={i === sel ? 650 : 450}
          fill={i === sel ? C.select : C.axis}
        >
          {fmtDate(obs[i].date, { year: false })}
        </text>
      ))}
    </>
  );
}

function SelectionGuide({ x, top, bottom }: { x: number; top: number; bottom: number }) {
  return <rect x={x - 11} y={top - 4} width={22} height={bottom - top + 8} rx={11} fill={C.select} opacity={0.08} />;
}

export function PainChart({ obs, baseline, selectedId, onSelect }: FullChartProps) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const h = 188;
  const x = xScale(obs, PAD.l, Math.max(PAD.l + 1, w - PAD.r));
  const y = (v: number) => PAD.t + ((10 - v) * (h - PAD.t - PAD.b)) / 10;
  const threshold = baseline + 2;
  const sel = obs.findIndex((o) => o.id === selectedId);

  return (
    <div ref={ref} className="w-full">
      {w > 0 ? (
        <svg width={w} height={h} role="img" aria-label={painSummary(obs, baseline)}>
          {[0, 5, 10].map((v) => (
            <g key={v}>
              <line x1={PAD.l} x2={w - PAD.r} y1={y(v)} y2={y(v)} stroke={C.grid} />
              <text x={PAD.l - 8} y={y(v) + 4} textAnchor="end" fontSize={11.5} fill={C.axis}>
                {v}
              </text>
            </g>
          ))}
          {sel >= 0 ? <SelectionGuide x={x(sel)} top={PAD.t} bottom={h - PAD.b} /> : null}
          <RefLine x0={PAD.l} x1={w - PAD.r} y={y(baseline)} color={C.baseline} label={`Baseline ${baseline}`} />
          {threshold <= 10 ? (
            <RefLine x0={PAD.l} x1={w - PAD.r} y={y(threshold)} color={C.watch} label={`Watch ≥ ${threshold}`} />
          ) : null}
          {segments(obs, (o) => o.pain).map((seg, si) => (
            <polyline
              key={si}
              points={seg.map((i) => `${x(i)},${y(obs[i].pain!)}`).join(" ")}
              fill="none"
              stroke={C.brand}
              strokeWidth={2.25}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
          {obs.map((o, i) => (
            <Point
              key={o.id}
              cx={x(i)}
              cy={o.pain === null ? h - PAD.b : y(o.pain)}
              missed={o.pain === null}
              flagged={o.painFlagged}
              selected={o.id === selectedId}
              label={o.pain === null ? `${fmtDate(o.date)}: no reply` : `${fmtDate(o.date)}: pain ${o.pain} of 10`}
              onClick={() => onSelect(o.id)}
            />
          ))}
          <XLabels obs={obs} x={x} h={h} selectedId={selectedId} />
        </svg>
      ) : (
        <div style={{ height: h }} />
      )}
    </div>
  );
}

export function WalkChart({ obs, baseline, selectedId, onSelect }: FullChartProps) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const h = 178;
  const x = xScale(obs, PAD.l + 10, Math.max(PAD.l + 11, w - PAD.r - 10));
  const y = (v: number) => PAD.t + ((7 - v) * (h - PAD.t - PAD.b)) / 7;
  const step = obs.length > 1 ? (w - PAD.l - PAD.r) / obs.length : 40;
  const bw = Math.max(6, Math.min(22, step * 0.5));
  const sel = obs.findIndex((o) => o.id === selectedId);

  return (
    <div ref={ref} className="w-full">
      {w > 0 ? (
        <svg width={w} height={h} role="img" aria-label={walkSummary(obs, baseline)}>
          {[0, 7].map((v) => (
            <g key={v}>
              <line x1={PAD.l} x2={w - PAD.r} y1={y(v)} y2={y(v)} stroke={C.grid} />
              <text x={PAD.l - 8} y={y(v) + 4} textAnchor="end" fontSize={11.5} fill={C.axis}>
                {v}
              </text>
            </g>
          ))}
          {sel >= 0 ? <SelectionGuide x={x(sel)} top={PAD.t} bottom={h - PAD.b} /> : null}
          {obs.map((o, i) => {
            const cx = x(i);
            const selected = o.id === selectedId;
            const label = o.walk === null ? `${fmtDate(o.date)}: no reply` : `${fmtDate(o.date)}: walked ${o.walk} of 7 days`;
            if (o.walk === null) {
              return (
                <Point key={o.id} cx={cx} cy={h - PAD.b} missed selected={selected} flagged={false} label={label} onClick={() => onSelect(o.id)} />
              );
            }
            const top = o.walk === 0 ? y(0) - 3 : y(o.walk);
            return (
              <g key={o.id} className="pw-chart-point" onClick={() => onSelect(o.id)}>
                <title>{label}</title>
                <rect x={cx - bw / 2 - 4} y={PAD.t} width={bw + 8} height={h - PAD.t - PAD.b} fill="transparent" />
                <rect
                  x={cx - bw / 2}
                  y={top}
                  width={bw}
                  height={y(0) - top}
                  rx={Math.min(6, bw / 2)}
                  fill={o.walkFlagged ? C.watch : C.brand}
                  opacity={selected ? 1 : 0.55}
                  stroke={selected ? C.select : "none"}
                  strokeWidth={selected ? 2 : 0}
                />
              </g>
            );
          })}
          <RefLine x0={PAD.l} x1={w - PAD.r} y={y(baseline)} color={C.baseline} label={`Baseline ${baseline}`} />
          <XLabels obs={obs} x={x} h={h} selectedId={selectedId} />
        </svg>
      ) : (
        <div style={{ height: h }} />
      )}
    </div>
  );
}

const MOODS: Mood[] = ["Good", "Okay", "Low"];

/** Mood is categorical: three lanes, one capsule per answer, consecutive Low reports joined. */
export function MoodChart({ obs, baseline, selectedId, onSelect }: Omit<FullChartProps, "baseline"> & { baseline: Mood }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const laneH = 34;
  const top = 10;
  const h = top + laneH * 3 + 28;
  const x = xScale(obs, PAD.l + 30, Math.max(PAD.l + 31, w - PAD.r));
  const laneY = (m: Mood) => top + MOODS.indexOf(m) * laneH + laneH / 2;
  const sel = obs.findIndex((o) => o.id === selectedId);

  // Pairs of consecutive Low answers to connect
  const lowLinks: [number, number][] = [];
  let prevLow = -1;
  obs.forEach((o, i) => {
    if (o.mood === null) return;
    if (o.mood === "Low" && prevLow >= 0) lowLinks.push([prevLow, i]);
    prevLow = o.mood === "Low" ? i : -1;
  });

  return (
    <div ref={ref} className="w-full">
      {w > 0 ? (
        <svg width={w} height={h} role="img" aria-label={moodSummary(obs, baseline)}>
          {MOODS.map((m) => (
            <g key={m}>
              <rect
                x={PAD.l + 18}
                y={laneY(m) - laneH / 2 + 3}
                width={Math.max(0, w - PAD.r - PAD.l - 18)}
                height={laneH - 6}
                rx={(laneH - 6) / 2}
                fill={m === baseline ? "#f1f4f8" : "transparent"}
              />
              <text x={PAD.l + 8} y={laneY(m) + 4} textAnchor="end" fontSize={12} fontWeight={m === baseline ? 650 : 450} fill={C.axis}>
                {m}
              </text>
            </g>
          ))}
          <text x={w - PAD.r + 8} y={laneY(baseline) + 4} fontSize={11.5} fill={C.axis}>
            Baseline
          </text>
          {sel >= 0 ? <SelectionGuide x={x(sel)} top={top} bottom={top + laneH * 3} /> : null}
          {lowLinks.map(([a, b]) => (
            <rect
              key={`${a}-${b}`}
              x={x(a)}
              y={laneY("Low") - 5}
              width={x(b) - x(a)}
              height={10}
              fill={C.moodLow}
              opacity={0.35}
            />
          ))}
          {obs.map((o, i) => {
            const cx = x(i);
            const label = o.mood === null ? `${fmtDate(o.date)}: no reply` : `${fmtDate(o.date)}: mood ${o.mood}`;
            const selected = o.id === selectedId;
            if (o.mood === null) {
              return <Point key={o.id} cx={cx} cy={top + laneH * 3 + 2} missed selected={selected} flagged={false} label={label} onClick={() => onSelect(o.id)} />;
            }
            return (
              <g key={o.id} className="pw-chart-point" onClick={() => onSelect(o.id)}>
                <title>{label}</title>
                <rect x={cx - 12} y={top} width={24} height={laneH * 3} fill="transparent" />
                <rect
                  x={cx - 9}
                  y={laneY(o.mood) - 7}
                  width={18}
                  height={14}
                  rx={7}
                  fill={MOOD_COLOR[o.mood]}
                  stroke={selected ? C.select : "#fff"}
                  strokeWidth={selected ? 2.5 : 1.5}
                />
              </g>
            );
          })}
          <XLabels obs={obs} x={x} h={h} selectedId={selectedId} />
        </svg>
      ) : (
        <div style={{ height: h }} />
      )}
    </div>
  );
}

function RefLine({ x0, x1, y, color, label }: { x0: number; x1: number; y: number; color: string; label: string }) {
  return (
    <g>
      <line x1={x0} x2={x1} y1={y} y2={y} stroke={color} strokeDasharray="5 4" strokeWidth={1.25} />
      <text x={x1 + 8} y={y + 4} fontSize={11.5} fontWeight={550} fill={color === C.watch ? C.watchInk : color}>
        {label}
      </text>
    </g>
  );
}

function Point({
  cx,
  cy,
  missed,
  flagged,
  selected,
  label,
  onClick,
}: {
  cx: number;
  cy: number;
  missed: boolean;
  flagged: boolean;
  selected: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <g className="pw-chart-point" onClick={onClick}>
      <title>{label}</title>
      <circle cx={cx} cy={cy} r={12} fill="transparent" />
      {missed ? (
        <circle cx={cx} cy={cy - 4} r={4} fill="#fff" stroke={selected ? C.select : C.missed} strokeWidth={1.5} strokeDasharray="2 1.5" />
      ) : (
        <circle
          cx={cx}
          cy={cy}
          r={selected ? 6 : 4}
          fill={flagged ? C.watch : C.brand}
          stroke={selected ? C.select : "#fff"}
          strokeWidth={selected ? 2.5 : 1.5}
        />
      )}
    </g>
  );
}

function painSummary(obs: TrendObservation[], baseline: number) {
  const vals = obs.filter((o) => o.pain !== null);
  const last = vals.at(-1);
  const missed = obs.length - vals.length;
  return `Pain over ${obs.length} check-ins. Baseline ${baseline} of 10. Latest ${last ? `${last.pain} of 10 on ${fmtDate(last.date)}` : "not recorded"}.${missed ? ` ${missed} check-ins had no reply.` : ""}`;
}

function walkSummary(obs: TrendObservation[], baseline: number) {
  const vals = obs.filter((o) => o.walk !== null);
  const last = vals.at(-1);
  return `Walking days per week over ${obs.length} check-ins. Baseline ${baseline}. Latest ${last ? `${last.walk} days on ${fmtDate(last.date)}` : "not recorded"}.`;
}

function moodSummary(obs: TrendObservation[], baseline: Mood) {
  const counts = { Good: 0, Okay: 0, Low: 0 };
  obs.forEach((o) => o.mood && counts[o.mood]++);
  return `Mood reports: ${counts.Good} Good, ${counts.Okay} Okay, ${counts.Low} Low. Baseline ${baseline}.`;
}
