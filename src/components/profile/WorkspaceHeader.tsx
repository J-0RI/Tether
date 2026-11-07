import {
  ArrowLeft,
  CalendarPlus,
  CheckCheck,
  ChevronUp,
  ClipboardCheck,
  ClipboardList,
  FileText,
  History,
  LayoutList,
  MoreHorizontal,
  NotebookPen,
  Share2,
  Video,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { daysUntil, fmtDate, fmtTimestamp, relDays } from "../../lib/dates";
import { CHANNEL_LABEL } from "../../lib/questions";
import type { Patient, Status, StatusResult } from "../../types";
import type { ActionHandlers, ActionModalKind } from "../ActionsPanel";
import { Button, Field, Modal } from "../ui";
import { CHANNEL_ICON, STATUS_META, inputCls, selectCls } from "../uiStyles";
import { SOURCE_LABEL, latestReview, reasonSource } from "./clinical";
import { portraitFor } from "./portraits";
import { useMedia } from "./useMedia";

const TONE: Record<Status, { text: string; bg: string }> = {
  act: { text: "text-act", bg: "bg-act-bg" },
  watch: { text: "text-watch", bg: "bg-watch-bg" },
  ok: { text: "text-ok", bg: "bg-ok-bg" },
};

const SEX_LABEL = { F: "Female", M: "Male" } as const;

/* ------------------------------------------------------------------ */
/* Photo                                                               */
/* ------------------------------------------------------------------ */

export function PatientPhoto({ p, size }: { p: Patient; size: number }) {
  const src = portraitFor(p.id);
  const [failed, setFailed] = useState(false);
  const radius = Math.round(size * 0.24);
  if (!src || failed) {
    const initials = p.name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2);
    return (
      <span
        role="img"
        aria-label={`${p.name}: no photo on file`}
        className="grid shrink-0 place-items-center bg-brand-tonal font-semibold tracking-[-0.02em] text-brand-ink"
        style={{ width: size, height: size, borderRadius: radius, fontSize: Math.round(size * 0.36) }}
      >
        {initials}
      </span>
    );
  }
  return (
    <img
      src={src}
      alt={`Portrait of ${p.name} (illustrative, fictional)`}
      width={size}
      height={size}
      onError={() => setFailed(true)}
      className="shrink-0 bg-track object-cover"
      style={{ width: size, height: size, borderRadius: radius }}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Status: one label, with the flags behind it available on demand     */
/* ------------------------------------------------------------------ */

export function StatusCapsule({
  p,
  result,
  size = "md",
  interactive = false,
}: {
  p: Patient;
  result: StatusResult;
  size?: "sm" | "md";
  interactive?: boolean;
}) {
  const m = STATUS_META[result.status];
  const t = TONE[result.status];
  const n = result.reasons.length;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useDismiss(open, ref, () => setOpen(false));
  const count = `${n} ${n === 1 ? "flag" : "flags"}`;

  return (
    <span ref={ref} className={`pw-status relative ${size === "sm" ? "pw-status-sm" : ""}`}>
      <span className={`pw-seg ${n ? "pw-seg-start" : "pw-seg-solo"} ${t.bg} ${t.text}`}>
        <span className={`pw-shape-${result.status} !shadow-none`} aria-hidden="true" />
        {m.label}
      </span>
      {n ? (
        interactive ? (
          <button
            type="button"
            aria-expanded={open}
            aria-haspopup="dialog"
            aria-label={`${count}: show flags behind this status`}
            onClick={() => setOpen((v) => !v)}
            className={`pw-seg pw-seg-end pw-status-cap ${t.bg} ${t.text}`}
          >
            {count}
            <ChevronUp className={`size-3.5 transition-transform ${open ? "" : "rotate-180"}`} aria-hidden="true" />
          </button>
        ) : (
          <span className={`pw-seg pw-seg-end ${t.bg} ${t.text}`}>{count}</span>
        )
      ) : null}
      {open ? <FlagDetails p={p} result={result} /> : null}
    </span>
  );
}

function FlagDetails({ p, result }: { p: Patient; result: StatusResult }) {
  const review = latestReview(p);
  return (
    <span role="dialog" aria-label="Flags behind this status" className="pw-menu pw-popover anim-enter">
      <span className="pw-eyebrow block">Flags behind this status</span>
      <ul role="list" className="mt-1.5 space-y-2">
        {result.reasons.map((r) => {
          const src = reasonSource(r, p);
          return (
            <li key={r.code} className="flex items-start gap-2.5">
              <span className="pw-marker !mt-0 !h-5 !w-3.5" aria-hidden="true">
                <span className={`pw-shape-${r.level} !shadow-none`} />
              </span>
              <span className="min-w-0 text-[13px] font-normal">
                <span className="block font-semibold text-ink">{r.label}</span>
                <span className="block text-[12px] text-muted">
                  {SOURCE_LABEL[src.source]}
                  {src.when ? ` · ${src.when}` : ""}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
      <span className="mt-2.5 block border-t border-line pt-2 text-[12px] font-normal text-muted">
        Automated classification from Tether's defined rules, not a clinical assessment.{" "}
        {review ? (
          <span className="text-select-ink">
            Reviewed by {review.by.replace(" (demo)", "")}, {fmtTimestamp(review.at)}; flags stay open until resolved.
          </span>
        ) : (
          "Not yet reviewed by the care team."
        )}
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Identity header: who the patient is, then their surgical context    */
/* ------------------------------------------------------------------ */

export function IdentityHeader({ p, result, onBack }: { p: Patient; result: StatusResult; onBack: () => void }) {
  const ContactIcon = CHANNEL_ICON[p.contactMethod];
  const d = p.surgeryDate ? daysUntil(p.surgeryDate) : null;
  const imminent = d !== null && d >= 0 && d <= 7;
  const small = useMedia("(max-width: 639px)");

  return (
    <header className="grid gap-x-8 gap-y-4 border-b border-line pb-4 lg:grid-cols-[minmax(0,auto)_1px_minmax(0,1fr)] lg:items-center">
      <div className="flex min-w-0 items-start gap-3.5">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to surgical waitlist"
          className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full text-ink-secondary transition-colors hover:bg-select-tonal hover:text-select-ink"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
        </button>
        <PatientPhoto p={p} size={small ? 56 : 72} />
        <div className="min-w-0 pt-0.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <h1 tabIndex={-1} className="text-[28px] leading-tight outline-none">{p.name}</h1>
            <StatusCapsule p={p} result={result} interactive />
          </div>
          <p className="mt-1 text-[16px] text-ink-secondary">
            <span className="tabular font-semibold whitespace-nowrap text-ink">{p.age} years</span>
            <span className="text-muted"> · </span>
            <span className="whitespace-nowrap">
              Recorded sex: <span className="font-semibold text-ink">{SEX_LABEL[p.sex]}</span>
            </span>
          </p>
          <p className="mt-0.5 text-[14px] text-muted">{p.community}, Saskatchewan</p>
        </div>
      </div>

      <span className="hidden h-full min-h-14 bg-line lg:block" aria-hidden="true" />

      <dl className="grid min-w-0 grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 xl:grid-cols-[1.25fr_1.25fr_1fr_0.8fr_1fr]">
        <Ctx label="Procedure" value={p.procedure} sub={p.surgeon} />
        <Ctx label="Site" value={p.site} sub={`${p.distanceKm} km from home`} />
        <Ctx
          label="Surgery"
          value={p.surgeryDate ? fmtDate(p.surgeryDate) : "Not yet booked"}
          sub={p.surgeryDate ? relDays(p.surgeryDate) : undefined}
          tone={imminent ? "text-act" : p.surgeryDate ? "text-ink" : "text-ink-secondary"}
        />
        <Ctx label="Waiting" value={`${p.weeksWaiting} weeks`} />
        <Ctx
          label="Contact"
          value={
            <span className="inline-flex items-center gap-1.5">
              <ContactIcon className="size-4 text-muted" aria-hidden="true" />
              {CHANNEL_LABEL[p.contactMethod]}
            </span>
          }
          sub={p.contactMethod === "caregiver" && p.caregiver ? `via ${p.caregiver.name}` : p.phone.replace(" (landline)", "")}
        />
      </dl>
    </header>
  );
}

function Ctx({ label, value, sub, tone = "text-ink" }: { label: string; value: React.ReactNode; sub?: string; tone?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[12px] text-muted">{label}</dt>
      <dd className={`text-[15px] leading-snug font-semibold ${tone}`}>{value}</dd>
      {sub ? <dd className="truncate text-[12.5px] text-muted">{sub}</dd> : null}
    </div>
  );
}

/** Slim identity bar that keeps the patient recognisable once the header has scrolled away. */
export function CondensedIdentity({
  p,
  result,
  visible,
  onBack,
}: {
  p: Patient;
  result: StatusResult;
  visible: boolean;
  onBack: () => void;
}) {
  return (
    <div className="pw-condensed" data-visible={visible} aria-hidden={!visible}>
      <div className="mx-auto flex max-w-[var(--max-shell)] items-center gap-3 px-[var(--page-gutter)] py-1.5">
        <button
          type="button"
          tabIndex={visible ? 0 : -1}
          onClick={onBack}
          aria-label="Back to surgical waitlist"
          className="grid size-7 shrink-0 place-items-center rounded-full text-ink-secondary hover:bg-select-tonal"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
        </button>
        <PatientPhoto p={p} size={30} />
        <span className="truncate text-[15px] font-semibold whitespace-nowrap text-ink">{p.name}</span>
        <span className="hidden text-[13.5px] whitespace-nowrap text-ink-secondary sm:inline">
          {p.age} years · {SEX_LABEL[p.sex]}
        </span>
        <StatusCapsule p={p} result={result} size="sm" />
        <span className="hidden min-w-0 truncate text-[13px] text-muted lg:inline">
          {p.procedure} · {p.surgeryDate ? `surgery ${fmtDate(p.surgeryDate, { year: false })}` : "not yet booked"}
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Bottom patient toolbar: section navigation left, actions right      */
/* ------------------------------------------------------------------ */

export type ToolbarTarget = "summary" | "checkins" | "readiness" | "medical" | "notes";

const NAV: { id: ToolbarTarget; label: string; short: string; icon: typeof History }[] = [
  { id: "summary", label: "Summary", short: "Summary", icon: LayoutList },
  { id: "checkins", label: "Check-ins", short: "History", icon: History },
  { id: "readiness", label: "Surgery readiness", short: "Readiness", icon: ClipboardList },
  { id: "medical", label: "Medical record", short: "Record", icon: FileText },
  { id: "notes", label: "Notes", short: "Notes", icon: NotebookPen },
];

export function PatientToolbar({
  p,
  result,
  active,
  onNavigate,
  onFollowUp,
  onAddNote,
  onModal,
  handlers,
}: {
  p: Patient;
  result: StatusResult;
  active: ToolbarTarget;
  onNavigate: (t: ToolbarTarget) => void;
  onFollowUp: () => void;
  onAddNote: () => void;
  onModal: (m: Exclude<ActionModalKind, null>) => void;
  handlers: ActionHandlers;
}) {
  return (
    <div className="pw-toolbar">
      <div className="flex items-center gap-2 py-2">
        <nav aria-label={`${p.name} record sections`} className="pw-toolbar-nav min-w-0 flex-1">
          <ul role="list" className="flex items-center gap-0.5 md:gap-1">
            {NAV.map((n) => {
              const Icon = n.icon;
              return (
                <li key={n.id} className={n.id === "summary" ? "pw-nav-summary" : undefined}>
                  <button
                    type="button"
                    className="pw-nav-item"
                    aria-current={n.id === active ? "true" : undefined}
                    onClick={() => onNavigate(n.id)}
                  >
                    <span className="pw-nav-icon">
                      <Icon className="size-[18px]" aria-hidden="true" />
                    </span>
                    <span className="hidden lg:inline">{n.label}</span>
                    <span className="lg:hidden">{n.short}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <span className="hidden h-7 w-px bg-line md:block" aria-hidden="true" />

        <div className="flex shrink-0 items-center gap-1.5" role="group" aria-label="Patient actions">
          {/* wrapper owns visibility: Button's own inline-flex would override `hidden` */}
          <span className="hidden lg:contents">
            <Button variant="secondary" onClick={onAddNote}>
              <NotebookPen className="size-4 text-brand" aria-hidden="true" />
              Add note
            </Button>
          </span>
          <Button onClick={onFollowUp} aria-label="Record follow-up">
            <ClipboardCheck className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">Record follow-up</span>
          </Button>
          <MoreActions p={p} result={result} onModal={onModal} handlers={handlers} onAddNote={onAddNote} />
        </div>
      </div>
    </div>
  );
}

function MoreActions({
  p,
  result,
  onModal,
  handlers,
  onAddNote,
}: {
  p: Patient;
  result: StatusResult;
  onModal: (m: Exclude<ActionModalKind, null>) => void;
  handlers: ActionHandlers;
  onAddNote: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(open, ref, () => setOpen(false));
  useEffect(() => {
    if (open) ref.current?.querySelector<HTMLButtonElement>("[role=menuitem]:not(:disabled)")?.focus();
  }, [open]);

  const hasFlags = result.reasons.length > 0;
  const reviewed = !!latestReview(p);
  const run = (fn: () => void) => {
    setOpen(false);
    fn();
  };

  return (
    <div ref={ref} className="relative">
      <Button variant="ghost" aria-haspopup="menu" aria-expanded={open} aria-label="More patient actions" onClick={() => setOpen((v) => !v)}>
        <MoreHorizontal className="size-4" aria-hidden="true" />
        <span className="hidden md:inline">More</span>
      </Button>
      {open ? (
        <div role="menu" aria-label="More patient actions" className="pw-menu pw-menu-up anim-enter">
          {/* the toolbar shows "Add note" directly from lg up; a wrapper keeps the utility from losing to .pw-menu-item */}
          <div className="lg:hidden">
            <MenuItem icon={NotebookPen} label="Add note" onClick={() => run(onAddNote)} />
          </div>
          <MenuItem icon={CalendarPlus} label="Schedule phone call" onClick={() => run(() => onModal("call"))} />
          <MenuItem
            icon={Video}
            label="Prepare video invitation"
            hint={p.contactMethod === "phone" ? "Landline only: not available" : undefined}
            onClick={() => run(() => onModal("video"))}
          />
          <MenuItem icon={Share2} label="Record referral" onClick={() => run(() => onModal("refer"))} />
          {hasFlags ? (
            <>
              <span className="my-1 block h-px bg-line" role="separator" />
              <MenuItem
                icon={CheckCheck}
                label={reviewed ? "Flags reviewed" : "Mark flags reviewed"}
                hint={reviewed ? "Already recorded for the latest check-in" : "Flags stay open until resolved"}
                disabled={reviewed}
                onClick={() =>
                  run(() =>
                    handlers.log(
                      "review",
                      `Reviewed active flags: ${result.reasons.map((r) => r.label).join("; ")}.`,
                      "Review recorded in demo",
                    ),
                  )
                }
              />
              <MenuItem icon={CheckCheck} label="Resolve flags…" hint="Once the underlying issue is addressed" onClick={() => run(() => onModal("resolve"))} />
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function MenuItem({
  icon: Icon,
  label,
  hint,
  disabled,
  onClick,
}: {
  icon: typeof Video;
  label: string;
  hint?: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" role="menuitem" disabled={disabled} className="pw-menu-item disabled:opacity-50" onClick={onClick}>
      <Icon className="size-4 shrink-0 text-brand" aria-hidden="true" />
      <span>
        <span className="block">{label}</span>
        {hint ? <span className="block text-[11.5px] font-normal text-muted">{hint}</span> : null}
      </span>
    </button>
  );
}

function useDismiss(open: boolean, ref: React.RefObject<HTMLElement | null>, close: () => void) {
  const closeRef = useRef(close);
  useEffect(() => {
    closeRef.current = close;
  });
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && closeRef.current();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, ref]);
}

/* ------------------------------------------------------------------ */

export function FollowUpModal({
  p,
  result,
  onClose,
  onSave,
}: {
  p: Patient;
  result: StatusResult;
  onClose: () => void;
  onSave: (text: string) => void;
}) {
  const methods = [
    p.contactMethod === "phone" ? "Phone call with patient (landline)" : "Phone call with patient",
    ...(p.caregiver ? [`Phone call with ${p.caregiver.name} (${p.caregiver.relationship.toLowerCase()})`] : []),
    ...(p.contactMethod === "phone" ? [] : ["Video visit"]),
    "Voicemail left, no contact",
    "In-person at clinic",
  ];
  const [method, setMethod] = useState(methods[0]);
  const [outcome, setOutcome] = useState("");
  const [next, setNext] = useState<"pending" | "none">("pending");
  const valid = outcome.trim().length >= 3;

  return (
    <Modal
      title="Record follow-up"
      onClose={onClose}
      wide
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!valid}
            onClick={() =>
              onSave(
                `${method}. Outcome: ${outcome.trim()}. ${
                  next === "pending" ? "Further follow-up needed." : "No further follow-up planned."
                }`,
              )
            }
          >
            <ClipboardCheck className="size-3.5" aria-hidden="true" />
            Save follow-up
          </Button>
        </>
      }
    >
      <div className="space-y-3.5">
        {result.reasons.length ? (
          <div className="rounded-[12px] bg-track/70 px-3 py-2 text-[12.5px] text-ink-secondary">
            <span className="font-semibold text-ink">Open flags:</span> {result.reasons.map((r) => r.label).join("; ")}
          </div>
        ) : null}
        <Field label="Contact">
          <select value={method} onChange={(e) => setMethod(e.target.value)} className={`${selectCls} w-full`}>
            {methods.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </Field>
        <Field label="Outcome (required)">
          <textarea
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
            rows={3}
            placeholder="Document what was discussed and agreed"
            className={inputCls}
          />
        </Field>
        <fieldset>
          <legend className="mb-1.5 text-[13px] font-semibold text-ink">Follow-up state</legend>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["pending", "Further follow-up needed"],
                ["none", "No further follow-up planned"],
              ] as const
            ).map(([id, label]) => (
              <label
                key={id}
                className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-[13px] ${
                  next === id ? "border-brand bg-brand-tonal/50 font-semibold text-brand-ink" : "border-line text-ink-secondary"
                }`}
              >
                <input type="radio" name="pw-next" className="accent-brand" checked={next === id} onChange={() => setNext(id)} />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        <p className="text-[12px] text-muted">
          Saved in this demo session only; no patient is contacted. Recording a follow-up does not resolve flags.
        </p>
      </div>
    </Modal>
  );
}
