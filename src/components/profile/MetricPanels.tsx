import { ChevronDown, Footprints, PhoneMissed, Smile, Zap } from "lucide-react";
import { useMemo, useState } from "react";
import { computePatientTrends, type MetricKey, type TrendObservation } from "../../lib/derive";
import type { CheckIn, Mood, Patient } from "../../types";
import { MoodChart, PainChart, WalkChart } from "./TrendGraphics";

type Tone = "pain" | "walk" | "mood";

// Category inks (matches the --color-*-ink tokens); identity, not severity
const INK: Record<Tone, string> = { pain: "#6b1f3d", walk: "#0b4f4a", mood: "#42267a" };

const MOOD_SHADE: Record<Mood, string> = { Low: "#42267a", Okay: "#8e7bc9", Good: "#cfc1f3" };

/**
 * Pain, walking and mood for the selected check-in against the referral baseline.
 */
export function MetricPanels({
  p,
  c,
  selectedId,
  onSelect,
}: {
  p: Patient;
  c: CheckIn;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const trends = useMemo(() => computePatientTrends(p), [p]);
  const [open, setOpen] = useState<MetricKey | null>(null);
  const obs = trends.observations;
  const a = c.answers;
  const toggle = (m: MetricKey) => setOpen((cur) => (cur === m ? null : m));

  const moodRun = useMemo(() => {
    let n = 0;
    for (let i = p.checkIns.findIndex((x) => x.id === c.id); i >= 0; i--) {
      const ci = p.checkIns[i];
      if (ci.missed) continue;
      if (ci.answers?.mood === "Low") n++;
      else break;
    }
    return n;
  }, [p, c.id]);

  const painDelta = a ? a.pain - p.baseline.pain : null;
  const walkDelta = a ? a.walk - p.baseline.walk : null;

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="pw-region-title">Patient-reported measurements</h3>
        <span className="text-[12px] text-muted">Compared with referral baseline</span>
      </div>

      {c.missed ? (
        <p className="mb-2 inline-flex items-center gap-1.5 text-[13px] text-watch">
          <PhoneMissed className="size-4" aria-hidden="true" />
          No reply to this check-in. History below shows every answered check-in.
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <MetricPanel
          tone="pain"
          icon={Zap}
          label="Pain"
          value={a ? String(a.pain) : "—"}
          unit="/10"
          comparison={
            painDelta === null
              ? `Baseline ${p.baseline.pain}/10`
              : painDelta === 0
                ? `Same as baseline (${p.baseline.pain})`
                : `${painDelta > 0 ? "Up" : "Down"} ${Math.abs(painDelta)} from baseline (${p.baseline.pain})`
          }
          flag={painDelta !== null && painDelta >= 2 ? "Above baseline" : undefined}
          expanded={open === "pain"}
          onToggle={() => toggle("pain")}
          graphic={<PainLine obs={obs} baseline={p.baseline.pain} selectedId={selectedId} />}
        />
        <MetricPanel
          tone="walk"
          icon={Footprints}
          label="Walking"
          value={a ? String(a.walk) : "—"}
          unit={a?.walk === 1 ? " day/wk" : " days/wk"}
          comparison={
            walkDelta === null
              ? `Baseline ${p.baseline.walk} days/wk`
              : walkDelta === 0
                ? `Same as baseline (${p.baseline.walk})`
                : `${Math.abs(walkDelta)} ${Math.abs(walkDelta) === 1 ? "day" : "days"} ${walkDelta < 0 ? "fewer" : "more"} than baseline (${p.baseline.walk})`
          }
          flag={walkDelta !== null && walkDelta <= -3 ? "Below baseline" : undefined}
          expanded={open === "walk"}
          onToggle={() => toggle("walk")}
          graphic={<WalkBars obs={obs} selectedId={selectedId} />}
        />
        <MetricPanel
          tone="mood"
          icon={Smile}
          label="Mood"
          value={a ? a.mood : "—"}
          unit=""
          comparison={
            !a
              ? `Baseline ${p.baseline.mood}`
              : moodRun >= 2
                ? `Low ${moodRun} check-ins in a row`
                : a.mood === p.baseline.mood
                  ? `Same as baseline (${p.baseline.mood})`
                  : `Baseline ${p.baseline.mood}`
          }
          flag={moodRun >= 2 ? "Low twice" : undefined}
          expanded={open === "mood"}
          onToggle={() => toggle("mood")}
          graphic={<MoodSequence obs={obs} selectedId={selectedId} />}
        />
      </div>

      {open ? (
        <div className="anim-enter border-x border-b border-line px-3 pt-2.5 pb-1">
          <div className="flex items-baseline justify-between gap-2">
            <h4 className="text-[13.5px] font-semibold text-ink">
              {open === "pain"
                ? "Pain, 0–10, every check-in"
                : open === "walk"
                  ? "Days walked 15+ minutes per week, 0–7"
                  : "Mood at each check-in"}
            </h4>
            <span className="text-[12px] text-muted">Select a point to open that check-in</span>
          </div>
          {open === "pain" ? (
            <PainChart obs={obs} baseline={p.baseline.pain} selectedId={selectedId} onSelect={onSelect} />
          ) : open === "walk" ? (
            <WalkChart obs={obs} baseline={p.baseline.walk} selectedId={selectedId} onSelect={onSelect} />
          ) : (
            <MoodChart obs={obs} baseline={p.baseline.mood} selectedId={selectedId} onSelect={onSelect} />
          )}
        </div>
      ) : null}
    </div>
  );
}

function MetricPanel({
  tone,
  icon: Icon,
  label,
  value,
  unit,
  comparison,
  flag,
  expanded,
  onToggle,
  graphic,
}: {
  tone: Tone;
  icon: typeof Zap;
  label: string;
  value: string;
  unit: string;
  comparison: string;
  flag?: string;
  expanded: boolean;
  onToggle: () => void;
  graphic: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`pw-metric pw-metric-${tone}`}
      aria-expanded={expanded}
      aria-label={`${label}: ${value}${unit}. ${comparison}.${flag ? ` Flag: ${flag}.` : ""} ${expanded ? "Hide" : "Show"} full history`}
      onClick={onToggle}
    >

      <span className="relative flex items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <span className="pw-metric-icon" aria-hidden="true">
            <Icon className="size-3.5" strokeWidth={2.4} />
          </span>
          <span className="text-[13px] font-semibold">{label}</span>
        </span>
      </span>

      <span className="relative mt-1.5 block">
        <span className="tabular text-[30px] leading-none font-semibold tracking-[-0.03em]">{value}</span>
        {value !== "—" && unit ? <span className="ml-0.5 text-[13px] font-medium opacity-75">{unit.trim()}</span> : null}
      </span>
      <span className="relative mt-1 block text-[12.5px] leading-snug">
        <span className="font-medium opacity-85">{comparison}</span>
        {flag ? (
          <span className="mt-0.5 flex items-center gap-1 font-semibold text-watch" title={flag}>
            <span className="size-1.5 rounded-[2px] bg-watch-fill" aria-hidden="true" />
            Flagged
          </span>
        ) : null}
      </span>

      <span className="relative mt-2 flex items-end justify-between gap-2">
        {graphic}
        <ChevronDown className={`size-4 shrink-0 opacity-70 transition-transform duration-150 ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Compact history graphics, drawn in the panel's category ink          */
/* ------------------------------------------------------------------ */

function PainLine({ obs, baseline, selectedId }: { obs: TrendObservation[]; baseline: number; selectedId: string }) {
  const w = 124;
  const h = 30;
  const n = obs.length;
  const x = (i: number) => (n === 1 ? w / 2 : 3 + (i * (w - 6)) / (n - 1));
  const y = (v: number) => 3 + ((10 - v) * (h - 6)) / 10;
  const runs: number[][] = [];
  let run: number[] = [];
  obs.forEach((o, i) => {
    if (o.pain === null) {
      if (run.length) runs.push(run);
      run = [];
    } else run.push(i);
  });
  if (run.length) runs.push(run);
  const sel = obs.findIndex((o) => o.id === selectedId);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" className="block">
      <line x1={0} x2={w} y1={y(baseline)} y2={y(baseline)} stroke={INK.pain} strokeOpacity={0.35} strokeDasharray="3 3" />
      {runs.map((r, ri) => (
        <polyline key={ri} points={r.map((i) => `${x(i)},${y(obs[i].pain!)}`).join(" ")} fill="none" stroke={INK.pain} strokeWidth={2} strokeLinejoin="round" />
      ))}
      {sel >= 0 && obs[sel].pain !== null ? <circle cx={x(sel)} cy={y(obs[sel].pain!)} r={3.5} fill={INK.pain} stroke="#fff" strokeWidth={1.5} /> : null}
    </svg>
  );
}

function WalkBars({ obs, selectedId }: { obs: TrendObservation[]; selectedId: string }) {
  const w = 124;
  const h = 30;
  const gap = 3;
  const bw = Math.max(4, (w - gap * (obs.length - 1)) / obs.length);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" className="block">
      {obs.map((o, i) => {
        const bx = i * (bw + gap);
        if (o.walk === null) return <circle key={o.id} cx={bx + bw / 2} cy={h - 3} r={2.2} fill="none" stroke={INK.walk} strokeOpacity={0.5} />;
        const bh = Math.max(3, (o.walk / 7) * h);
        return <rect key={o.id} x={bx} y={h - bh} width={bw} height={bh} rx={Math.min(3, bw / 2)} fill={INK.walk} opacity={o.id === selectedId ? 1 : 0.38} />;
      })}
    </svg>
  );
}

/** Mood is categorical: one connected segment per check-in, darker for lower mood, with counts in words. */
function MoodSequence({ obs, selectedId }: { obs: TrendObservation[]; selectedId: string }) {
  const counts = { Good: 0, Okay: 0, Low: 0 };
  obs.forEach((o) => o.mood && counts[o.mood]++);
  return (
    <span className="block min-w-0">
      <span className="m3-connected-bar h-3 w-[124px]">
        {obs.map((o) => (
          <span
            key={o.id}
            className="m3-connected-segment h-full flex-1"
            style={
              o.mood
                ? { background: MOOD_SHADE[o.mood], boxShadow: o.id === selectedId ? `inset 0 0 0 2px ${INK.mood}` : undefined }
                : { background: "transparent", boxShadow: `inset 0 0 0 1.5px ${INK.mood}55` }
            }
          />
        ))}
      </span>
      <span className="mt-1 block text-[11px] font-medium opacity-80">
        {counts.Good} Good · {counts.Okay} Okay · {counts.Low} Low
      </span>
    </span>
  );
}
