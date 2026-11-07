import { AlertTriangle, Check, ChevronDown, Clock, Database, Minus } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { fmtDate, fmtMonthYear, relDays } from "../../lib/dates";
import { readinessBreakdown } from "../../lib/derive";
import { READINESS_ITEMS } from "../../lib/questions";
import type { Patient, ReadinessItem, ReadinessKey, ReadinessState } from "../../types";
import type { ActionHandlers } from "../ActionsPanel";
import { Button, Field, Modal } from "../ui";
import { inputCls } from "../uiStyles";
import { VideoFollowUp } from "./VideoFollowUp";

export function ClinicalContext({ patient: p, handlers }: { patient: Patient; handlers: ActionHandlers }) {
  return (
    <section aria-label="Surgery readiness, medical context and video follow-up" className="flex min-h-0 flex-1 flex-col">
      <div id="pw-readiness" tabIndex={-1} className="pw-anchor flex-none">
        <Readiness p={p} handlers={handlers} />
      </div>
      <div id="pw-medical" tabIndex={-1} className="pw-section pw-anchor flex-none">
        <MedicalContext p={p} />
      </div>
      <div className="pw-section pw-video-section flex flex-col">
        <VideoFollowUp key={p.id} p={p} />
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Surgery readiness                                                    */
/* ------------------------------------------------------------------ */

/** Neutral requirement names: the checklist labels read as already-confirmed statements. */
const REQUIREMENT: Record<ReadinessKey, string> = {
  bloodwork: "Pre-op bloodwork",
  anesthesia: "Anesthesia consult",
  meds: "Medication review",
  fasting: "Fasting and medication instructions",
  ride: "Transportation home",
  homeHelp: "Support at home, first 24 hours",
  travel: "Travel and accommodation",
  prehab: "Prehab exercise plan",
  wants: "Wish to proceed with surgery",
};

const STATE_LABEL: Record<ReadinessState, string> = {
  done: "Confirmed",
  missing: "Not confirmed",
  notdue: "Not yet due",
  na: "Not applicable",
};

const SEG: Record<ReadinessState, string> = {
  done: "bg-ok-fill",
  missing: "bg-act-fill",
  notdue: "bg-line-strong",
  na: "bg-track",
};

function StateMark({ state }: { state: ReadinessState }) {
  const base = "grid size-4 shrink-0 place-items-center";
  if (state === "done")
    return (
      <span className={`${base} rounded-full bg-ok-bg text-ok`} aria-hidden="true">
        <Check className="size-2.5" strokeWidth={3.5} />
      </span>
    );
  if (state === "missing")
    return (
      <span className={base} aria-hidden="true">
        <span className="size-2 rotate-45 rounded-[2px] bg-act-fill" />
      </span>
    );
  if (state === "notdue")
    return (
      <span className={`${base} rounded-full border border-dashed border-control-border text-muted`} aria-hidden="true">
        <Clock className="size-2" strokeWidth={3} />
      </span>
    );
  return (
    <span className={`${base} text-muted`} aria-hidden="true">
      <Minus className="size-3" strokeWidth={2.5} />
    </span>
  );
}

function Readiness({ p, handlers }: { p: Patient; handlers: ActionHandlers }) {
  const rb = readinessBreakdown(p.readiness);
  const [showAll, setShowAll] = useState(false);
  const [confirming, setConfirming] = useState<ReadinessItem | null>(null);
  const listId = useId();

  const ordered = READINESS_ITEMS.map((def) => p.readiness.find((r) => r.key === def.key)).filter(
    (r): r is ReadinessItem => !!r,
  );
  const missing = ordered.filter((r) => r.state === "missing");

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h2 className="pw-region-title">Surgery readiness</h2>
        <span className="flex items-center gap-2">
          <span
            className="m3-connected-bar h-1.5 w-20"
            role="img"
            aria-label={`${rb.ready} confirmed, ${rb.missing} not confirmed, ${rb.notDue} not yet due`}
          >
            {ordered
              .filter((r) => r.state !== "na")
              .map((r) => (
                <span key={r.key} className={`m3-connected-segment h-full flex-1 ${SEG[r.state]}`} />
              ))}
          </span>
          <span className="tabular text-[12.5px] text-ink-secondary">
            <b className="font-semibold text-ink">{rb.ready}</b> of {rb.total}
          </span>
        </span>
      </div>
      <div className="mt-0.5 flex items-baseline justify-between gap-2">
      <p className="text-[12.5px] text-ink-secondary">
        {p.surgeryDate ? (
          <>
            Surgery {fmtDate(p.surgeryDate, { year: false })} · <span className="font-semibold text-ink">{relDays(p.surgeryDate)}</span>
          </>
        ) : (
          "Surgery not yet booked"
        )}
        {rb.notDue ? ` · ${rb.notDue} not yet due` : ""}
      </p>
      <button
        type="button"
        aria-expanded={showAll}
        aria-controls={listId}
        onClick={() => setShowAll((v) => !v)}
        className="inline-flex shrink-0 items-center gap-1 text-[12.5px] font-semibold text-brand hover:underline"
      >
        {showAll ? "Hide all" : "View all"}
        <ChevronDown className={`size-3.5 transition-transform ${showAll ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      </div>

      {missing.length ? (
        <ul role="list" className="mt-2 space-y-1.5">
          {missing.map((r) => (
            <li key={r.key} className="grid grid-cols-[16px_minmax(0,1fr)_auto] items-start gap-x-2">
              <span className="pt-0.5">
                <StateMark state="missing" />
              </span>
              <span className="min-w-0">
                <span className="block text-[13.5px] font-semibold text-ink">{REQUIREMENT[r.key]}</span>
                <span className="block text-[12px] text-muted">
                  {r.detail ? `${r.detail} · ` : ""}
                  <button
                    type="button"
                    onClick={() => setConfirming(r)}
                    className="font-semibold text-brand hover:underline"
                    aria-label={`Record confirmation: ${REQUIREMENT[r.key]}`}
                  >
                    Record confirmation
                  </button>
                </span>
              </span>
              <span className="pt-px text-[12.5px] font-semibold text-act">Not confirmed</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 inline-flex items-center gap-1.5 text-[13px] text-ok">
          <Check className="size-4" strokeWidth={2.5} aria-hidden="true" />
          No outstanding requirements
        </p>
      )}

      {showAll ? (
        <ul id={listId} role="list" className="anim-enter scroll-panel mt-1.5 max-h-40 divide-y divide-line border-t border-line">
          {ordered.map((r) => (
            <li key={r.key} className="flex items-center gap-2 py-1.5 text-[13px]">
              <StateMark state={r.state} />
              <span className="min-w-0 flex-1 truncate text-ink" title={r.detail}>
                {REQUIREMENT[r.key]}
              </span>
              <span className={`text-[12px] ${r.state === "missing" ? "font-semibold text-act" : "text-muted"}`}>
                {STATE_LABEL[r.state]}
                {r.state === "done" && r.date ? ` · ${fmtDate(r.date, { year: false })}` : ""}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {confirming ? <ConfirmRequirement item={confirming} handlers={handlers} onClose={() => setConfirming(null)} /> : null}
    </div>
  );
}

function ConfirmRequirement({
  item,
  handlers,
  onClose,
}: {
  item: ReadinessItem;
  handlers: ActionHandlers;
  onClose: () => void;
}) {
  const [checked, setChecked] = useState(false);
  const [note, setNote] = useState("");
  const name = REQUIREMENT[item.key];
  return (
    <Modal
      title={`Confirm: ${name}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!checked || note.trim().length < 3}
            onClick={() => {
              handlers.resolve(
                item.key === "wants" ? ["readiness:wants", "not-wanting"] : [`readiness:${item.key}`],
                [item.key],
                note.trim(),
              );
              onClose();
            }}
          >
            Mark as confirmed
          </Button>
        </>
      }
    >
      <p className="mb-3 text-[13px] text-ink-secondary">
        Currently <b className="font-semibold text-act">not confirmed</b>
        {item.detail ? `: ${item.detail}` : ""}.
      </p>
      <label className="mb-3 flex cursor-pointer items-start gap-2.5 text-[13px] text-ink">
        <input type="checkbox" className="mt-0.5 size-4 accent-brand" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
        I confirmed with the patient or caregiver that this requirement is in place.
      </label>
      <Field label="How it was confirmed (required)">
        <textarea
          data-autofocus
          className={inputCls}
          rows={2}
          placeholder="e.g. Sister will drive him home; confirmed by phone"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Medical context                                                      */
/* ------------------------------------------------------------------ */

function MedicalContext({ p }: { p: Patient }) {
  const r = p.record;
  const noAllergy = r.allergies.every((a) => /no known/i.test(a));

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="pw-region-title">Medical context</h2>
        <span className="inline-flex items-center gap-1 text-[12px] text-muted">
          <Database className="size-3.5" aria-hidden="true" />
          Imported record
        </span>
      </div>

      {/* Allergies stay outside the scroll area so they are never hidden */}
      <div className="mt-1.5 mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-[12px] font-semibold text-muted">Allergies</span>
        {noAllergy ? (
          <span className="text-[13px] text-ink">{r.allergies.join("; ")}</span>
        ) : (
          r.allergies.map((a) => (
            <span key={a} className="inline-flex items-center gap-1 rounded-[6px] bg-watch-bg px-2 py-0.5 text-[12.5px] font-semibold text-watch">
              <AlertTriangle className="size-3" aria-hidden="true" />
              {a}
            </span>
          ))
        )}
      </div>

      <div className="pw-med-list" role="region" aria-label="Medical record sections" tabIndex={0}>
        <Group title="Conditions" summary={r.diagnoses[0]} count={r.diagnoses.length + r.comorbidities.filter((c) => !/none/i.test(c)).length}>
          <ul role="list" className="space-y-0.5 text-[13px]">
            {r.diagnoses.map((d) => (
              <li key={d} className="font-semibold text-ink">
                {d} <span className="font-normal text-muted">· surgical diagnosis</span>
              </li>
            ))}
            {r.comorbidities.map((c) => (
              <li key={c} className="text-ink">
                {c}
              </li>
            ))}
          </ul>
        </Group>

        <Group title="Medications" summary={r.medications.map((m) => m.split(" ")[0]).join(", ")} count={r.medications.length}>
          <ul role="list" className="space-y-0.5 text-[13px] text-ink">
            {r.medications.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </Group>

        <Group title="Referral baseline" summary={`Pain ${p.baseline.pain}/10 · Walking ${p.baseline.walk} d/wk · Mood ${p.baseline.mood}`}>
          <dl className="tabular grid grid-cols-3 gap-2 text-[13px]">
            <Stat label="Pain" value={`${p.baseline.pain}/10`} />
            <Stat label="Walking" value={`${p.baseline.walk} d/wk`} />
            <Stat label="Mood" value={p.baseline.mood} />
          </dl>
          <p className="mt-1 text-[12px] text-muted">Reported at referral, {fmtDate(p.referralDate)}</p>
        </Group>

        <Group title="Vitals" summary={`BP ${r.bloodPressure} · BMI ${r.bmi}`}>
          <dl className="tabular grid grid-cols-2 gap-2 text-[13px]">
            <Stat label="Blood pressure" value={r.bloodPressure} sub={fmtDate(r.bloodPressureDate)} />
            <Stat label="BMI" value={`${r.bmi} kg/m²`} />
          </dl>
        </Group>

        <Group title="Imaging & referral" summary={r.imaging}>
          <dl className="space-y-1.5 text-[13px]">
            <Stat label="Last imaging" value={`${r.imaging}, ${fmtMonthYear(p.referralDate)}`} />
            <Stat label="Referring physician" value={r.referringPhysician} />
            <Stat label="Surgeon" value={`${p.surgeon} · ${p.site}`} />
            <Stat label="Referral received" value={fmtDate(p.referralDate)} />
          </dl>
        </Group>

        <Group
          title="Contact & caregiver"
          summary={p.caregiver ? `${p.caregiver.name} (${p.caregiver.relationship.toLowerCase()})` : "No caregiver listed"}
        >
          <dl className="space-y-1.5 text-[13px]">
            <Stat label="Patient phone" value={p.phone} />
            <Stat
              label="Caregiver"
              value={p.caregiver ? `${p.caregiver.name}, ${p.caregiver.relationship} · ${p.caregiver.phone}` : "None listed"}
            />
            <Stat label="Distance to site" value={`${p.distanceKm} km to ${p.siteCity}`} />
          </dl>
        </Group>
      </div>
    </div>
  );
}

function Group({ title, summary, count, children }: { title: string; summary: string; count?: number; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="pw-disclosure">
      <button type="button" className="pw-disclosure-btn px-2" aria-expanded={open} aria-controls={id} onClick={() => setOpen((v) => !v)}>
        <span className="min-w-0">
          <span className="text-[13px] font-semibold text-ink">
            {title}
            {count !== undefined ? <span className="tabular ml-1 font-medium text-muted">({count})</span> : null}
          </span>
          {!open ? <span className="block truncate text-[12.5px] text-ink-secondary">{summary}</span> : null}
        </span>
        <ChevronDown className={`size-4 shrink-0 text-muted transition-transform duration-150 ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      {open ? (
        <div id={id} className="anim-enter px-2 pt-1.5 pb-2.5">
          {children}
        </div>
      ) : null}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <dt className="text-[11.5px] text-muted">{label}</dt>
      <dd className="font-medium text-ink">{value}</dd>
      {sub ? <dd className="text-[11.5px] text-muted">{sub}</dd> : null}
    </div>
  );
}
