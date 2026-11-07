import type { Channel, Status } from "../types";

export type SpecialFilter = null | "attention" | "noReply" | "soon" | "readinessGap";

export interface Filters {
  q: string;
  status: "all" | Status;
  procedure: string;
  site: string;
  channel: "all" | Channel;
  special: SpecialFilter;
}

export const EMPTY_FILTERS: Filters = {
  q: "",
  status: "all",
  procedure: "all",
  site: "all",
  channel: "all",
  special: null,
};

export function hasActiveFilters(f: Filters): boolean {
  return (
    f.q.trim() !== "" ||
    f.status !== "all" ||
    f.procedure !== "all" ||
    f.site !== "all" ||
    f.channel !== "all" ||
    f.special !== null
  );
}
