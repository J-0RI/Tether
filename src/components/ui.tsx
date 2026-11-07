import { Check, X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { CHANNEL_LABEL } from "../lib/questions";
import type { Channel, Status } from "../types";
import { CHANNEL_ICON, STATUS_META } from "./uiStyles";

export type WorkflowState =
  | "needs-review"
  | "reviewed"
  | "pending"
  | "resolved";

/**
 * Coherent clinical priority capsule.
 * Communicates clinical urgency through label, typography, and restrained
 * geometric markers rather than software error/warning triangles.
 */
export function StatusPill({
  status,
  size = "sm",
}: {
  status: Status;
  size?: "sm" | "md";
}) {
  const m = STATUS_META[status];
  const toneCls: Record<Status, string> = {
    act: "bg-act-bg text-act font-semibold",
    watch: "bg-watch-bg text-watch font-semibold",
    ok: "bg-ok-bg/85 text-ok font-medium",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full tracking-[-0.01em] ${toneCls[status]} ${
        size === "md"
          ? "px-2.5 py-1 text-[12.5px]"
          : "px-2 py-0.5 text-[11.5px]"
      }`}
    >
      {status === "act" ? (
        <span
          className="inline-block h-2.5 w-[3px] shrink-0 rounded-full bg-act-fill"
          aria-hidden="true"
        />
      ) : status === "watch" ? (
        <span
          className="inline-block size-1.5 shrink-0 rounded-full bg-watch-fill"
          aria-hidden="true"
        />
      ) : null}
      <span className="clinical-pill-label">{m.label}</span>
    </span>
  );
}

/**
 * Care-team workflow state indicator — intentionally neutral and distinct from
 * clinical risk statuses (`Act now`, `Watch`, `On track`).
 */
export function WorkflowStateBadge({ state }: { state: WorkflowState }) {
  if (state === "reviewed" || state === "resolved") {
    return (
      <span className="inline-flex items-center gap-1 whitespace-nowrap text-[11.5px] font-medium text-muted">
        <Check className="size-3 text-ok" strokeWidth={2.4} aria-hidden="true" />
        <span className="clinical-pill-label">
          {state === "reviewed" ? "Reviewed" : "Resolved"}
        </span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center whitespace-nowrap rounded-md border border-line-strong bg-white px-1.5 py-0.5 text-[11px] font-medium text-ink-secondary">
      <span className="clinical-pill-label">
        {state === "needs-review" ? "Needs review" : "Follow-up pending"}
      </span>
    </span>
  );
}

export function ChannelBadge({
  channel,
  withLabel = true,
  detail,
}: {
  channel: Channel;
  withLabel?: boolean;
  detail?: string;
}) {
  const Icon = CHANNEL_ICON[channel];
  return (
    <span className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-secondary">
      <Icon className="size-3.5 shrink-0 text-muted" aria-hidden="true" />
      {withLabel ? (
        <span>
          {CHANNEL_LABEL[channel]}
          {detail ? <span className="text-muted"> · {detail}</span> : null}
        </span>
      ) : (
        <span className="visually-hidden">{CHANNEL_LABEL[channel]}</span>
      )}
    </span>
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "tonal" | "secondary" | "ghost" | "urgent";
  size?: "sm" | "md";
}) {
  const variants = {
    primary:
      "bg-brand text-white hover:bg-brand-hover disabled:opacity-45",
    tonal:
      "bg-brand-tonal text-brand-ink hover:brightness-95 disabled:opacity-45",
    urgent:
      "bg-act text-white hover:brightness-95 disabled:opacity-45",
    secondary:
      "border border-control-border bg-white text-ink hover:bg-hover disabled:opacity-45",
    ghost:
      "text-brand hover:bg-brand-tonal/60 disabled:opacity-45",
  }[variant];

  const sizes = {
    sm: "px-3 py-1 text-[12.5px] gap-1.5",
    md: "px-3.5 py-1.5 text-[13px] gap-1.5",
  }[size];

  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center rounded-full font-semibold transition-colors duration-150 ${variants} ${sizes} ${className}`}
      {...props}
    />
  );
}

export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { id: T; label: string; count?: number | string }[];
  onChange: (next: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="m3-segmented-track">
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            className="m3-segmented-btn"
            aria-pressed={active}
            onClick={() => onChange(opt.id)}
          >
            <span>{opt.label}</span>
            {opt.count !== undefined ? (
              <span
                className={`tabular rounded-full px-1.5 py-0.2 text-[11px] font-semibold ${
                  active
                    ? "bg-white/20 text-white"
                    : "bg-white text-ink-secondary"
                }`}
              >
                {opt.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function Modal({
  title,
  onClose,
  children,
  footer,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(onClose);
  const titleId = useId();

  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previous = document.activeElement as HTMLElement | null;

    if (!dialog.open) {
      dialog.showModal();
    }

    const handleClose = () => closeRef.current();
    dialog.addEventListener("close", handleClose);

    // Safari fallback when declarative closedby="any" is unavailable
    const handleBackdropClick = (event: MouseEvent) => {
      if ("closedBy" in HTMLDialogElement.prototype) return;
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      const inside =
        rect.top <= event.clientY &&
        event.clientY <= rect.top + rect.height &&
        rect.left <= event.clientX &&
        event.clientX <= rect.left + rect.width;
      if (!inside) {
        dialog.close();
      }
    };
    dialog.addEventListener("click", handleBackdropClick);

    const focusTarget = dialog.querySelector<HTMLElement>(
      "[data-autofocus], input:not([type='radio']):not([type='checkbox']), select, textarea",
    );
    focusTarget?.focus();

    return () => {
      dialog.removeEventListener("close", handleClose);
      dialog.removeEventListener("click", handleBackdropClick);
      if (dialog.open) dialog.close();
      previous?.focus();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      className={`tether-dialog anim-enter ${wide ? "dialog-wide" : ""}`}
      {...({ closedby: "any" } as Record<string, string>)}
    >
      <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
        <h2 id={titleId} className="text-[17px] font-semibold text-ink">
          {title}
        </h2>
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          className="rounded-full p-1.5 text-muted hover:bg-hover hover:text-ink"
          aria-label="Close dialog"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
      <div className="px-5 py-4 text-[13.5px]">{children}</div>
      {footer ? (
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3">
          {footer}
        </div>
      ) : null}
    </dialog>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[13px] font-semibold text-ink">
        {label}
      </span>
      {children}
      {hint ? (
        <span className="mt-1 block text-[12px] text-muted">{hint}</span>
      ) : null}
    </label>
  );
}
