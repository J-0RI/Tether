import { CheckCircle2, MessageSquareText, X } from "lucide-react";

export interface Toast {
  id: string;
  title: string;
  body?: string;
  tone?: "success" | "incoming";
  action?: { label: string; onClick: () => void };
}

export function Toasts({
  toasts,
  dismiss,
}: {
  toasts: Toast[];
  dismiss: (id: string) => void;
}) {
  return (
    <div
      className="pointer-events-none fixed right-5 bottom-5 z-[60] flex w-[min(390px,calc(100vw-32px))] flex-col gap-2.5"
      aria-live="polite"
    >
      {toasts.map((t) => {
        const Icon = t.tone === "incoming" ? MessageSquareText : CheckCircle2;
        return (
          <div
            key={t.id}
            className="anim-enter pointer-events-auto flex items-start gap-3 rounded-2xl border border-ink/10 bg-ink px-4 py-3 text-white shadow-lg"
          >
            <span
              className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-full ${
                t.tone === "incoming"
                  ? "bg-select-tonal text-select-ink"
                  : "bg-white/15 text-white"
              }`}
            >
              <Icon className="size-4" aria-hidden="true" />
            </span>

            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-semibold leading-snug">
                {t.title}
              </div>
              {t.body ? (
                <div className="mt-0.5 text-[12.5px] text-white/80">
                  {t.body}
                </div>
              ) : null}
              {t.action ? (
                <button
                  type="button"
                  onClick={() => {
                    t.action!.onClick();
                    dismiss(t.id);
                  }}
                  className="mt-2 rounded-full bg-select-tonal px-3 py-1 text-[12px] font-semibold text-select-ink hover:brightness-95"
                >
                  {t.action.label}
                </button>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="rounded-full p-1 text-white/70 hover:bg-white/15 hover:text-white"
              aria-label="Dismiss notification"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
