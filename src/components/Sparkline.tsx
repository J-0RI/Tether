import { latestAnswered } from "../calculateStatus";
import { parseDate } from "../lib/dates";
import type { Patient } from "../types";

export function Sparkline({ patient: p }: { patient: Patient }) {
  const last = latestAnswered(p);
  if (!last?.answers) {
    return <span className="text-[12px] text-muted">No reply</span>;
  }

  const points = p.checkIns;
  const width = 64;
  const height = 22;
  const pad = 3;
  const first = points[0] ? parseDate(points[0].date).getTime() : 0;
  const span = Math.max(1, parseDate(points.at(-1)!.date).getTime() - first);
  const x = (date: string) =>
    pad + ((parseDate(date).getTime() - first) / span) * (width - pad * 2);
  const y = (v: number) => pad + ((10 - v) / 10) * (height - pad * 2);

  const delta = last.answers.pain - p.baseline.pain;
  const flagged = delta >= 2;
  const stroke = flagged ? "#d97706" : "#0b7a8e";

  const d = points
    .map((c, i) => {
      if (c.missed || !c.answers) return "";
      const prev = points[i - 1];
      const cmd = prev && !prev.missed && prev.answers ? "L" : "M";
      return `${cmd}${x(c.date).toFixed(1)},${y(c.answers.pain).toFixed(1)}`;
    })
    .filter(Boolean)
    .join(" ");

  return (
    <div className="inline-flex items-center gap-2">
      <span
        className={`tabular text-[13px] font-semibold ${
          flagged ? "text-watch" : "text-ink"
        }`}
      >
        {last.answers.pain}
        <span className="text-[11px] font-normal text-muted">/10</span>
      </span>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Pain ${last.answers.pain}/10 (baseline ${p.baseline.pain}/10)`}
        className="block shrink-0"
      >
        <line
          x1={pad}
          x2={width - pad}
          y1={y(p.baseline.pain)}
          y2={y(p.baseline.pain)}
          stroke="#cbd5e1"
          strokeDasharray="2 2"
        />
        <path
          d={d}
          fill="none"
          stroke={stroke}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle
          cx={x(last.date)}
          cy={y(last.answers.pain)}
          r={2.8}
          fill={stroke}
          stroke="#ffffff"
          strokeWidth={1}
        />
      </svg>
    </div>
  );
}
