import type { ReactNode } from "react";

export function Shell({
  onHome,
  isSubView,
  isOverview = false,
  children,
}: {
  onHome: () => void;
  isSubView: boolean;
  isOverview?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="app-shell" data-overview={isOverview ? "true" : undefined}>
      <a className="skip-link visually-hidden" href="#main-content">
        Skip to main content
      </a>

      <div className="global-chrome">
        <header className="masthead">
          <div className="flex min-w-0 items-center gap-3.5">
            <button
              type="button"
              onClick={onHome}
              className="group inline-flex items-center gap-2 rounded-lg py-1 pr-1 text-brand focus-visible:outline-2"
              aria-label={
                isSubView
                  ? "Tether — return to surgical waitlist dashboard"
                  : "Tether surgical care coordination"
              }
            >
              <svg
                width="24"
                height="26"
                viewBox="0 0 31 34"
                fill="none"
                aria-hidden="true"
                className="shrink-0"
              >
                <path
                  d="M9 5h12a7 7 0 0 1 0 14h-4M22 29H10a7 7 0 0 1 0-14h4"
                  stroke="currentColor"
                  strokeWidth="5"
                  strokeLinecap="round"
                />
              </svg>
              <span className="text-[21px] font-bold tracking-[-0.035em] text-ink group-hover:text-brand">
                Tether
              </span>
            </button>
          </div>

          {/* Centred on the full header width, independent of the side columns */}
          <p className="masthead-title">Surgical care coordination</p>

          <div className="flex shrink-0 items-center justify-self-end">
            <div
              className="hidden items-center gap-2 md:flex"
              aria-label="Active care-team coordinator: K. Ross, RN"
            >
              <span
                className="grid size-7 place-items-center rounded-full bg-brand-tonal text-[11px] font-bold text-brand-ink"
                aria-hidden="true"
              >
                KR
              </span>
              <div className="leading-tight">
                <div className="text-[12.5px] font-semibold text-ink">
                  K. Ross, RN
                </div>
                <div className="text-[11px] text-muted">Care coordinator</div>
              </div>
            </div>
          </div>
        </header>
      </div>

      <main
        id="main-content"
        tabIndex={-1}
        data-overview={isOverview ? "true" : undefined}
        className="workspace focus:outline-none"
      >
        {children}
      </main>

    </div>
  );
}
