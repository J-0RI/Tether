import {
  CalendarPlus,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Info,
  MessageSquareText,
  NotebookPen,
  PhoneCall,
  Send,
  Share2,
  Video,
} from "lucide-react";
import { useState } from "react";
import { daysFromNow, fmtDate, fmtTimestamp } from "../lib/dates";
import type {
  ActivityEntry,
  Patient,
  ReadinessKey,
  StatusResult,
} from "../types";
import { Button, Field, Modal } from "./ui";
import { inputCls, selectCls } from "./uiStyles";

const REFERRALS = ["Physiotherapy", "Dietitian", "Counselling", "Social work"];

const KIND_META: Record<
  ActivityEntry["kind"],
  { icon: typeof Video; label: string; clinical: boolean }
> = {
  followup: { icon: PhoneCall, label: "Follow-up", clinical: true },
  review: { icon: CheckCheck, label: "Flag review", clinical: true },
  video: { icon: Video, label: "Video invite", clinical: true },
  call: { icon: PhoneCall, label: "Phone follow-up", clinical: true },
  refer: { icon: Share2, label: "Referral", clinical: true },
  resolved: { icon: CheckCheck, label: "Resolved", clinical: true },
  note: { icon: NotebookPen, label: "Clinical note", clinical: true },
  checkin: { icon: MessageSquareText, label: "Check-in", clinical: false },
  system: { icon: ClipboardList, label: "System", clinical: false },
};

export interface ActionHandlers {
  log: (kind: ActivityEntry["kind"], text: string, toast: string) => void;
  resolve: (
    codes: string[],
    readinessKeys: ReadinessKey[],
    note: string,
  ) => void;
  saveNote: (text: string) => void;
}

export type ActionModalKind = null | "video" | "call" | "refer" | "resolve";

export function FollowUpActionBar({
  result,
  handlers,
  onOpenModal,
}: {
  result: StatusResult;
  handlers: ActionHandlers;
  onOpenModal: (kind: Exclude<ActionModalKind, null>) => void;
}) {
  const hasFlags = result.reasons.length > 0;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant={result.status === "act" ? "urgent" : "primary"}
        size="sm"
        onClick={() => onOpenModal("call")}
      >
        <PhoneCall className="size-3.5" aria-hidden="true" />
        <span>Schedule phone call</span>
      </Button>

      <Button
        variant="secondary"
        size="sm"
        onClick={() => onOpenModal("video")}
      >
        <Video className="size-3.5" aria-hidden="true" />
        <span>Video invitation</span>
      </Button>

      <Button
        variant="secondary"
        size="sm"
        onClick={() => onOpenModal("refer")}
      >
        <Share2 className="size-3.5" aria-hidden="true" />
        <span>Refer</span>
      </Button>

      {hasFlags ? (
        <>
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              handlers.log(
                "review",
                `Reviewed active flags: ${result.reasons.map((r) => r.label).join("; ")}. Follow-up pending.`,
                "Review recorded in demo",
              )
            }
          >
            <CheckCheck className="size-3.5 text-muted" aria-hidden="true" />
            <span>Mark reviewed</span>
          </Button>

          <Button
            variant="tonal"
            size="sm"
            onClick={() => onOpenModal("resolve")}
          >
            <CheckCheck className="size-3.5" aria-hidden="true" />
            <span>
              Resolve {result.reasons.length === 1 ? "flag" : `flags (${result.reasons.length})`}
            </span>
          </Button>
        </>
      ) : null}
    </div>
  );
}

export function CareTeamActivitySection({
  patient,
  handlers,
}: {
  patient: Patient;
  handlers: ActionHandlers;
}) {
  const [note, setNote] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const reversed = [...patient.activity].reverse();
  const visible = showAll ? reversed : reversed.slice(0, 4);
  const hiddenCount = Math.max(0, reversed.length - 4);

  return (
    <section aria-labelledby="patient-activity-heading">
      <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 id="patient-activity-heading">
            Care-team notes &amp; activity log
          </h2>
          <p className="mt-0.5 text-[12px] text-muted">
            Documented interventions &amp; automated check-in events (
            {reversed.length})
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            aria-expanded={composerOpen}
            onClick={() => setComposerOpen((v) => !v)}
            className="inline-flex items-center gap-1 rounded-full border border-control-border bg-white px-2.5 py-1 text-[12px] font-semibold text-ink hover:bg-hover"
          >
            <NotebookPen className="size-3.5 text-brand" aria-hidden="true" />
            <span>{composerOpen ? "Close note" : "Add note"}</span>
          </button>

          {hiddenCount > 0 ? (
            <button
              type="button"
              aria-expanded={showAll}
              onClick={() => setShowAll((v) => !v)}
              className="inline-flex items-center gap-1 rounded-full bg-track px-2.5 py-1 text-[12px] font-semibold text-ink-secondary hover:bg-select-tonal hover:text-select-ink"
            >
              <span>
                {showAll ? "Recent 4" : `All (${reversed.length})`}
              </span>
              {showAll ? (
                <ChevronUp className="size-3.5" aria-hidden="true" />
              ) : (
                <ChevronDown className="size-3.5" aria-hidden="true" />
              )}
            </button>
          ) : null}
        </div>
      </div>

      {composerOpen ? (
        <div className="mb-3 rounded-xl border border-line-strong bg-white p-3">
          <Field
            label="New care-coordination note"
            hint="Saved locally in this demo session. Adding a note does not clear active clinical flags."
          >
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder={`Document clinical assessment or outreach for ${patient.firstName}…`}
              className={`${inputCls} resize-y`}
            />
          </Field>
          <div className="mt-2 flex justify-end gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setComposerOpen(false);
                setNote("");
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!note.trim()}
              onClick={() => {
                handlers.saveNote(note.trim());
                setNote("");
                setComposerOpen(false);
              }}
            >
              <NotebookPen className="size-3.5" aria-hidden="true" />
              <span>Save note</span>
            </Button>
          </div>
        </div>
      ) : null}

      <ol role="list" className="divide-y divide-line border-y border-line-strong">
        {visible.map((a) => {
          const meta = KIND_META[a.kind];
          const Icon = meta.icon;
          return (
            <li key={a.id} className="flex items-start gap-2.5 py-2.5">
              <span
                className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full ${
                  a.kind === "resolved"
                    ? "bg-ok-bg text-ok"
                    : meta.clinical
                      ? "bg-brand-tonal text-brand-ink"
                      : "bg-track text-muted"
                }`}
              >
                <Icon className="size-3.5" aria-hidden="true" />
              </span>

              <div className="min-w-0 flex-1">
                <div className="text-[13px] text-ink">{a.text}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11.5px] text-muted">
                  <span className="font-medium text-ink-secondary">
                    {meta.clinical ? a.by : "Tether automated"}
                  </span>
                  <span>·</span>
                  <span className="tabular">{fmtTimestamp(a.at)}</span>
                  <span>·</span>
                  <span>{meta.label}</span>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function ActionModals({
  modal,
  onClose,
  patient,
  result,
  handlers,
}: {
  modal: ActionModalKind;
  onClose: () => void;
  patient: Patient;
  result: StatusResult;
  handlers: ActionHandlers;
}) {
  if (!modal) return null;

  if (modal === "video") {
    return (
      <VideoModal
        patient={patient}
        onClose={onClose}
        onSend={(to) => {
          handlers.log(
            "video",
            `Simulated video invitation prepared for ${to}`,
            "Video invitation recorded in demo",
          );
          onClose();
        }}
      />
    );
  }

  if (modal === "call") {
    return (
      <CallModal
        patient={patient}
        onClose={onClose}
        onSave={(text, toast) => {
          handlers.log("call", text, toast);
          onClose();
        }}
      />
    );
  }

  if (modal === "refer") {
    return (
      <ReferModal
        patient={patient}
        onClose={onClose}
        onSave={(text, toast) => {
          handlers.log("refer", text, toast);
          onClose();
        }}
      />
    );
  }

  return (
    <ResolveModal
      result={result}
      onClose={onClose}
      onSave={(codes, keys, note) => {
        handlers.resolve(codes, keys, note);
        onClose();
      }}
    />
  );
}

function VideoModal({
  patient,
  onClose,
  onSend,
}: {
  patient: Patient;
  onClose: () => void;
  onSend: (to: string) => void;
}) {
  const cg =
    patient.contactMethod === "caregiver" ? patient.caregiver : undefined;
  const landline = patient.contactMethod === "phone";
  const toName = cg ? cg.name.split(" ")[0] : patient.firstName;
  const toLabel = cg
    ? `${cg.name} (${cg.relationship.toLowerCase()}) · ${cg.phone}`
    : `${patient.name} · ${patient.phone}`;
  const code = patient.id.slice(0, 2).toUpperCase() + patient.weeksWaiting;
  const msg = cg
    ? `Hi ${toName}, ${patient.firstName}'s care team would like a short video check-in. Join here: https://tether.example/v/${code}`
    : `Hi ${toName}, your care team would like a short video check-in. Join here: https://tether.example/v/${code}`;

  return (
    <Modal
      title="Prepare simulated video invitation"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => onSend(cg ? cg.name : patient.name)}
            disabled={landline}
            data-autofocus
          >
            <Send className="size-3.5" aria-hidden="true" />
            <span>Record simulated invitation</span>
          </Button>
        </>
      }
    >
      <div className="mb-3">
        <div className="text-[11.5px] font-semibold text-muted">Recipient</div>
        <div className="text-[14px] font-semibold text-ink">{toLabel}</div>
      </div>

      {landline ? (
        <div className="flex gap-2.5 rounded-lg border border-watch-line bg-watch-bg p-3 text-[13px] text-watch">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>
            {patient.firstName} uses an automated landline voice check-in and
            cannot open a video link. Schedule a phone call instead, or add a
            caregiver with a mobile number.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-1.5 text-[12px] font-semibold text-ink-secondary">
            Outbound invitation text (simulated)
          </div>
          <div className="rounded-lg border border-line-strong bg-white px-3.5 py-2.5 text-[13px] leading-relaxed text-ink">
            {msg}
          </div>
          <p className="mt-2.5 text-[12px] text-muted">
            This example URL is non-functional. Recording the invitation logs
            the outreach in this local demo only; no message is transmitted.
          </p>
        </>
      )}
    </Modal>
  );
}

function CallModal({
  patient,
  onClose,
  onSave,
}: {
  patient: Patient;
  onClose: () => void;
  onSave: (text: string, toast: string) => void;
}) {
  const [date, setDate] = useState(daysFromNow(1));
  const [time, setTime] = useState("10:00");
  const who =
    patient.contactMethod === "caregiver" && patient.caregiver
      ? patient.caregiver
      : null;
  const [h, m] = time.split(":").map(Number);
  const timeLabel = new Date(2000, 0, 1, h || 0, m || 0).toLocaleTimeString(
    "en-US",
    { hour: "numeric", minute: "2-digit" },
  );
  const when = date ? `${fmtDate(date)} at ${timeLabel}` : "";

  return (
    <Modal
      title="Schedule phone follow-up"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!date || !time || date < daysFromNow(0)}
            onClick={() =>
              onSave(
                `Simulated phone follow-up scheduled for ${when}${who ? ` with ${who.name}` : ""}`,
                `Demo follow-up recorded: ${when}`,
              )
            }
          >
            <CalendarPlus className="size-3.5" aria-hidden="true" />
            <span>Schedule call</span>
          </Button>
        </>
      }
    >
      <p className="mb-3.5 text-[13px] text-ink-secondary">
        Calling{" "}
        <strong className="font-semibold text-ink">
          {who
            ? `${who.name} (${who.relationship.toLowerCase()}) at ${who.phone}`
            : `${patient.name} at ${patient.phone}`}
        </strong>
        . Scheduling a follow-up logs outreach without clearing active flags.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Date">
          <input
            type="date"
            value={date}
            min={daysFromNow(0)}
            onChange={(e) => setDate(e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Time">
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className={inputCls}
          />
        </Field>
      </div>
    </Modal>
  );
}

function ReferModal({
  patient,
  onClose,
  onSave,
}: {
  patient: Patient;
  onClose: () => void;
  onSave: (text: string, toast: string) => void;
}) {
  const [to, setTo] = useState(REFERRALS[0]);
  const [reason, setReason] = useState("");
  return (
    <Modal
      title="Record allied-health referral"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() =>
              onSave(
                `Simulated referral to ${to}${reason.trim() ? `: ${reason.trim()}` : ""}`,
                `Demo referral recorded for ${patient.firstName}`,
              )
            }
          >
            <Share2 className="size-3.5" aria-hidden="true" />
            <span>Record demo referral</span>
          </Button>
        </>
      }
    >
      <div className="space-y-3.5">
        <Field label="Service">
          <select
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className={`${selectCls} w-full`}
          >
            {REFERRALS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </Field>
        <Field label="Clinical reason (optional)">
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Pre-operative mobility decline, pain limiting walking"
            className={inputCls}
          />
        </Field>
      </div>
    </Modal>
  );
}

function ResolveModal({
  result,
  onClose,
  onSave,
}: {
  result: StatusResult;
  onClose: () => void;
  onSave: (
    codes: string[],
    readinessKeys: ReadinessKey[],
    note: string,
  ) => void;
}) {
  const [picked, setPicked] = useState<Set<string>>(
    () => new Set(result.reasons.map((r) => r.code)),
  );
  const [note, setNote] = useState("");
  const chosen = result.reasons.filter((r) => picked.has(r.code));
  const valid = chosen.length > 0 && note.trim().length >= 3;

  return (
    <Modal
      title="Resolve clinical or readiness flag"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!valid}
            onClick={() =>
              onSave(
                chosen.map((r) => r.code),
                chosen.flatMap((r) => (r.readinessKey ? [r.readinessKey] : [])),
                note.trim(),
              )
            }
          >
            <CheckCheck className="size-3.5" aria-hidden="true" />
            <span>Confirm resolution</span>
          </Button>
        </>
      }
    >
      <div className="space-y-3.5">
        <fieldset>
          <legend className="mb-2 text-[13px] font-semibold text-ink">
            Select resolved flags
          </legend>
          <div className="space-y-1.5">
            {result.reasons.map((r) => {
              const checked = picked.has(r.code);
              return (
                <label
                  key={r.code}
                  className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2 text-[13px] transition-colors ${
                    checked
                      ? "border-brand bg-brand-tonal/25"
                      : "border-line bg-white hover:bg-hover"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 size-4 accent-brand"
                    checked={checked}
                    onChange={() =>
                      setPicked((s) => {
                        const n = new Set(s);
                        if (n.has(r.code)) n.delete(r.code);
                        else n.add(r.code);
                        return n;
                      })
                    }
                  />
                  <span className="font-medium text-ink">{r.label}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <Field
          label="Resolution documentation (required)"
          hint="Flags remain cleared until a subsequent check-in triggers a new rule. Associated readiness items are marked confirmed."
        >
          <textarea
            data-autofocus
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="e.g. Spoke with patient; sister confirmed post-op drive home"
            className={inputCls}
          />
        </Field>
      </div>
    </Modal>
  );
}
