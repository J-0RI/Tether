import { ChevronDown, ChevronUp, Database } from "lucide-react";
import { useState } from "react";
import { fmtDate, fmtMonthYear } from "../lib/dates";
import type { Patient } from "../types";

export function MedicalRecordCard({ patient: p }: { patient: Patient }) {
  const [expanded, setExpanded] = useState(false);
  const r = p.record;
  const hasDrugAllergy = !r.allergies.every((a) =>
    a.toLowerCase().includes("no known"),
  );

  return (
    <section aria-labelledby="patient-medical-record-heading">
      <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 id="patient-medical-record-heading">
            Medical record &amp; baseline
          </h2>
          <p className="mt-0.5 inline-flex items-center gap-1.5 text-[12px] text-muted">
            <Database className="size-3.5 shrink-0" aria-hidden="true" />
            <span>
              Fictional imported record · Referral {fmtDate(p.referralDate)} ·
              No live integration
            </span>
          </p>
        </div>

        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
          className="inline-flex items-center gap-1 rounded-full bg-track px-2.5 py-1 text-[12px] font-semibold text-ink-secondary hover:bg-select-tonal hover:text-select-ink"
        >
          <span>{expanded ? "Compact summary" : "Full record"}</span>
          {expanded ? (
            <ChevronUp className="size-3.5" aria-hidden="true" />
          ) : (
            <ChevronDown className="size-3.5" aria-hidden="true" />
          )}
        </button>
      </div>

      {/* Compact Always-Visible Clinical Context Summary */}
      <dl className="divide-y divide-line border-y border-line-strong text-[13px]">
        <div className="grid grid-cols-1 gap-1 py-2 sm:grid-cols-[128px_1fr] sm:gap-3">
          <dt className="text-[12px] font-semibold text-muted">Diagnosis</dt>
          <dd className="font-medium text-ink">{r.diagnoses.join("; ")}</dd>
        </div>

        <div className="grid grid-cols-1 gap-1 py-2 sm:grid-cols-[128px_1fr] sm:gap-3">
          <dt className="text-[12px] font-semibold text-muted">Allergies</dt>
          <dd>
            {hasDrugAllergy ? (
              <span className="inline-flex flex-wrap gap-1.5">
                {r.allergies.map((alg) => (
                  <span
                    key={alg}
                    className="rounded-full bg-watch-bg px-2 py-0.5 text-[12px] font-semibold text-watch"
                  >
                    {alg}
                  </span>
                ))}
              </span>
            ) : (
              <span className="text-ink-secondary">
                {r.allergies.join("; ")}
              </span>
            )}
          </dd>
        </div>

        <div className="grid grid-cols-1 gap-1 py-2 sm:grid-cols-[128px_1fr] sm:gap-3">
          <dt className="text-[12px] font-semibold text-muted">
            Referral baseline
          </dt>
          <dd className="tabular text-ink">
            Pain <strong>{p.baseline.pain}/10</strong> · Walking{" "}
            <strong>{p.baseline.walk} days/wk</strong> · Mood{" "}
            <strong>{p.baseline.mood}</strong>
          </dd>
        </div>

        <div className="grid grid-cols-1 gap-1 py-2 sm:grid-cols-[128px_1fr] sm:gap-3">
          <dt className="text-[12px] font-semibold text-muted">
            Vitals &amp; BMI
          </dt>
          <dd className="tabular text-ink-secondary">
            BP <strong className="text-ink">{r.bloodPressure}</strong> (
            {fmtDate(r.bloodPressureDate, { year: false })}) · BMI{" "}
            <strong className="text-ink">{r.bmi} kg/m²</strong>
          </dd>
        </div>

        {!expanded ? (
          <div className="grid grid-cols-1 gap-1 py-2 sm:grid-cols-[128px_1fr] sm:gap-3">
            <dt className="text-[12px] font-semibold text-muted">
              Medications ({r.medications.length})
            </dt>
            <dd className="truncate text-ink-secondary">
              {r.medications.join(" · ")}
            </dd>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-1 py-2 sm:grid-cols-[128px_1fr] sm:gap-3">
              <dt className="text-[12px] font-semibold text-muted">
                Comorbidities
              </dt>
              <dd className="text-ink">
                <ul role="list" className="space-y-0.5">
                  {r.comorbidities.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </dd>
            </div>

            <div className="grid grid-cols-1 gap-1 py-2 sm:grid-cols-[128px_1fr] sm:gap-3">
              <dt className="text-[12px] font-semibold text-muted">
                Medications ({r.medications.length})
              </dt>
              <dd className="text-ink">
                <ul role="list" className="space-y-0.5">
                  {r.medications.map((med) => (
                    <li key={med}>{med}</li>
                  ))}
                </ul>
              </dd>
            </div>

            <div className="grid grid-cols-1 gap-1 py-2 sm:grid-cols-[128px_1fr] sm:gap-3">
              <dt className="text-[12px] font-semibold text-muted">Imaging</dt>
              <dd className="text-ink-secondary">
                {r.imaging} · {fmtMonthYear(p.referralDate)}
              </dd>
            </div>

            <div className="grid grid-cols-1 gap-1 py-2 sm:grid-cols-[128px_1fr] sm:gap-3">
              <dt className="text-[12px] font-semibold text-muted">
                Referral &amp; surgeon
              </dt>
              <dd className="text-ink-secondary">
                Referred by <strong className="text-ink">{r.referringPhysician}</strong>{" "}
                · Assigned surgeon <strong className="text-ink">{p.surgeon}</strong>
              </dd>
            </div>

            <div className="grid grid-cols-1 gap-1 py-2 sm:grid-cols-[128px_1fr] sm:gap-3">
              <dt className="text-[12px] font-semibold text-muted">
                Caregiver
              </dt>
              <dd className="text-ink-secondary">
                {p.caregiver
                  ? `${p.caregiver.name} (${p.caregiver.relationship}) · ${p.caregiver.phone}`
                  : "None listed"}
              </dd>
            </div>
          </>
        )}
      </dl>
    </section>
  );
}
