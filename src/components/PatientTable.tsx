import { ArrowDown, ArrowUp, ChevronRight, SearchX } from "lucide-react";
import { latestAnswered } from "../calculateStatus";
import { daysUntil, fmtDate, relDays } from "../lib/dates";
import { latestSummary, readinessBreakdown, type Row } from "../lib/derive";
import { Sparkline } from "./Sparkline";
import { ChannelBadge, StatusPill } from "./ui";

export type Sort = "priority" | "name" | "surgery" | "waiting";

export interface TableSort {
  key: Sort;
  descending: boolean;
}

export function PatientTable({
  rows,
  highlightId,
  onOpen,
  onClearFilters,
  sort,
  onSort,
}: {
  rows: Row[];
  highlightId: string | null;
  onOpen: (id: string) => void;
  onClearFilters: () => void;
  sort: TableSort;
  onSort: (s: TableSort) => void;
}) {
  if (!rows.length) {
    return (
      <div className="flex flex-col items-center gap-2 border-y border-line py-10 text-center">
        <SearchX className="size-6 text-muted" aria-hidden="true" />
        <h3 className="text-[15px] font-semibold text-ink">
          No patients match the active filters
        </h3>
        <p className="text-[13px] text-muted">
          Adjust your search query or reset filters to view the complete surgical
          waitlist.
        </p>
        <button
          type="button"
          onClick={onClearFilters}
          className="mt-1 rounded-full bg-brand-tonal px-3.5 py-1 text-[12.5px] font-semibold text-brand-ink hover:brightness-95"
        >
          Reset filters
        </button>
      </div>
    );
  }

  const sortHeader = (label: string, key: Sort) => {
    const active = sort.key === key;
    return (
      <button
        type="button"
        onClick={() =>
          onSort({ key, descending: active ? !sort.descending : false })
        }
        className="inline-flex items-center gap-1 font-semibold text-ink-secondary hover:text-ink"
      >
        <span>{label}</span>
        {active ? (
          sort.descending ? (
            <ArrowDown className="size-3.5 text-brand" aria-hidden="true" />
          ) : (
            <ArrowUp className="size-3.5 text-brand" aria-hidden="true" />
          )
        ) : (
          <span className="text-[11px] text-muted" aria-hidden="true">
            ↕
          </span>
        )}
      </button>
    );
  };

  const ariaSort = (key: Sort) =>
    sort.key === key
      ? sort.descending
        ? ("descending" as const)
        : ("ascending" as const)
      : ("none" as const);

  return (
    <div className="clinical-table-wrap">
      <table className="clinical-table min-w-[980px]">
        <caption className="visually-hidden">
          Complete surgical waitlist registry. Select a patient to open their
          clinical record.
        </caption>
        <thead>
          <tr>
            <th scope="col" aria-sort={ariaSort("priority")}>
              {sortHeader("Status", "priority")}
            </th>
            <th scope="col" aria-sort={ariaSort("name")}>
              {sortHeader("Patient", "name")}
            </th>
            <th scope="col">Procedure &amp; hospital</th>
            <th scope="col" aria-sort={ariaSort("surgery")}>
              {sortHeader("Surgery timing", "surgery")}
            </th>
            <th scope="col" aria-sort={ariaSort("waiting")}>
              {sortHeader("Wait", "waiting")}
            </th>
            <th scope="col">Clinical status &amp; latest check-in</th>
            <th scope="col">Pain trend</th>
            <th scope="col">Readiness</th>
            <th scope="col">Contact</th>
            <th scope="col">
              <span className="visually-hidden">Open record</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ patient: p, result }) => {
            const last = latestAnswered(p);
            const rb = readinessBreakdown(p.readiness);
            const daysLeft = p.surgeryDate ? daysUntil(p.surgeryDate) : null;
            const urgentDate = daysLeft !== null && daysLeft >= 0 && daysLeft <= 7;

            return (
              <tr
                key={p.id}
                onClick={() => onOpen(p.id)}
                className={`interactive-row ${
                  highlightId === p.id ? "anim-flash" : ""
                }`}
              >
                <td className="whitespace-nowrap">
                  <StatusPill status={result.status} />
                </td>
                <td>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpen(p.id);
                    }}
                    className="text-left text-[13.5px] font-semibold text-ink hover:text-brand hover:underline"
                  >
                    {p.name}
                  </button>
                  <div className="mt-0.5 text-[12px] text-muted">
                    {p.age}
                    {p.sex} · {p.community}
                  </div>
                </td>
                <td>
                  <div className="text-[13px] font-medium text-ink">
                    {p.procedure}
                  </div>
                  <div className="mt-0.5 text-[12px] text-muted">
                    {p.site.replace(" Hospital", "")} · {p.surgeon}
                  </div>
                </td>
                <td className="whitespace-nowrap">
                  {p.surgeryDate ? (
                    <>
                      <div className="text-[13px] font-medium text-ink">
                        {fmtDate(p.surgeryDate, { year: false })}
                      </div>
                      <div
                        className={`mt-0.5 text-[12px] ${
                          urgentDate
                            ? "font-semibold text-act"
                            : "text-muted"
                        }`}
                      >
                        {relDays(p.surgeryDate)}
                      </div>
                    </>
                  ) : (
                    <span className="text-[12.5px] text-muted">Unbooked</span>
                  )}
                </td>
                <td className="whitespace-nowrap">
                  <span className="tabular text-[13px] font-medium text-ink">
                    {p.weeksWaiting}w
                  </span>
                </td>
                <td className="max-w-[320px]">
                  <div className="text-[13px] leading-snug text-ink">
                    {result.reasons.length > 0 ? (
                      <span className="font-medium">
                        {result.reasons.map((r) => r.label).join(" · ")}
                      </span>
                    ) : (
                      <span className="text-ink-secondary">
                        {latestSummary(p, result)}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-[11.5px] text-muted">
                    {last
                      ? `Last reply ${fmtDate(last.date, { year: false })}`
                      : "No replies recorded"}
                  </div>
                </td>
                <td className="whitespace-nowrap">
                  <Sparkline patient={p} />
                </td>
                <td className="whitespace-nowrap">
                  <span className="tabular text-[12.5px] font-medium text-ink">
                    {rb.ready}/{rb.total}
                  </span>
                  {rb.missing > 0 ? (
                    <span className="ml-1.5 inline-block rounded-full bg-act-bg px-1.5 py-0.2 text-[11px] font-semibold text-act">
                      {rb.missing} gap{rb.missing > 1 ? "s" : ""}
                    </span>
                  ) : null}
                </td>
                <td className="whitespace-nowrap">
                  <ChannelBadge channel={p.contactMethod} />
                </td>
                <td className="text-right">
                  <ChevronRight
                    className="inline size-4 text-muted"
                    aria-hidden="true"
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
