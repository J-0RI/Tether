import { RotateCcw, Send } from "lucide-react";
import { useState } from "react";
import { CHANNEL_LABEL } from "../lib/questions";
import { SCENARIOS, type Scenario } from "../state";
import type { Patient } from "../types";
import { Button, Field, Modal } from "./ui";
import { selectCls } from "./uiStyles";

export function DemoPanel({
  patients,
  defaultPatientId,
  onSimulate,
  onReset,
  onClose,
}: {
  patients: Patient[];
  defaultPatientId: string | null;
  onSimulate: (id: string, scenario: Scenario) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const [pid, setPid] = useState(defaultPatientId ?? "james-lee");
  const [scenario, setScenario] = useState<Scenario>("pain-worse");
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <Modal
      title="Demo simulation controls"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button
            onClick={() => {
              onSimulate(pid, scenario);
              onClose();
            }}
          >
            <Send className="size-3.5" aria-hidden="true" />
            <span>Simulate incoming check-in</span>
          </Button>
        </>
      }
    >
      <p className="mb-4 text-[13px] text-ink-secondary">
        Inject a simulated patient check-in to observe deterministic rule
        recalculation across the priority worklist, recent check-ins, clinical
        trends, and patient record. No external messages are sent.
      </p>

      <Field label="Target patient">
        <select
          data-autofocus
          className={`${selectCls} w-full`}
          value={pid}
          onChange={(e) => setPid(e.target.value)}
        >
          {[...patients]
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {p.procedure} ({CHANNEL_LABEL[p.contactMethod]})
              </option>
            ))}
        </select>
      </Field>

      <fieldset className="mt-4">
        <legend className="mb-2 text-[13px] font-semibold text-ink">
          Simulated response scenario
        </legend>
        <div className="space-y-1.5">
          {SCENARIOS.map((s) => {
            const active = scenario === s.id;
            return (
              <label
                key={s.id}
                className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2 transition-colors ${
                  active
                    ? "border-brand bg-brand-tonal/30"
                    : "border-line bg-white hover:bg-hover"
                }`}
              >
                <input
                  type="radio"
                  name="scenario"
                  className="mt-1 size-4 accent-brand"
                  checked={active}
                  onChange={() => setScenario(s.id)}
                />
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-ink">
                    {s.label}
                  </span>
                  <span className="block text-[12px] text-muted">{s.hint}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-4 border-t border-line pt-3.5">
        {confirmReset ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[13px] font-medium text-ink">
              Restore all 12 patients to initial sample state?
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setConfirmReset(false)}
              >
                Cancel
              </Button>
              <Button
                variant="urgent"
                size="sm"
                onClick={() => {
                  onReset();
                  onClose();
                }}
              >
                Reset demo data
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirmReset(true)}
          >
            <RotateCcw className="size-3.5" aria-hidden="true" />
            <span>Reset demo to initial state</span>
          </Button>
        )}
      </div>
    </Modal>
  );
}
