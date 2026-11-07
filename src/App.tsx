import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import type { ActionHandlers } from "./components/ActionsPanel";
import {
  DashboardWorkspace,
  type FocusedSection,
} from "./components/DashboardWorkspace";
import { DemoPanel } from "./components/DemoPanel";
import { PatientProfile } from "./components/PatientProfile";
import type { TableSort } from "./components/PatientTable";
import { Shell } from "./components/Shell";
import { Toasts, type Toast } from "./components/Toasts";
import { Button } from "./components/ui";
import { DEMO_DATE } from "./lib/dates";
import { buildRows } from "./lib/derive";
import { EMPTY_FILTERS, type Filters } from "./lib/filters";
import { initialPatients } from "./mockData";
import { SCENARIOS, reducer, uid, type Scenario } from "./state";

type Route =
  | { page: "dashboard"; focused: FocusedSection }
  | { page: "patient"; id: string };

const FOCUSED_SECTIONS = new Set<Exclude<FocusedSection, null>>([
  "attention",
  "checkins",
  "readiness",
  "waitlist",
]);

function parseHash(): Route {
  const h = window.location.hash.replace(/^#\/?/, "");
  const [a, b] = h.split("/");
  if (a === "patient" && b) {
    return { page: "patient", id: b };
  }
  if (a === "focus" && b && FOCUSED_SECTIONS.has(b as Exclude<FocusedSection, null>)) {
    return { page: "dashboard", focused: b as FocusedSection };
  }
  if (a === "checkins" || a === "readiness") {
    return { page: "dashboard", focused: a };
  }
  return { page: "dashboard", focused: null };
}

function useRoute(): [
  Route,
  (r: Route) => void,
  React.MutableRefObject<FocusedSection>,
] {
  const [route, setRoute] = useState<Route>(parseHash);
  const previous = useRef<Route>(route);
  const lastDashboardFocus = useRef<FocusedSection>(
    route.page === "dashboard" ? route.focused : null,
  );
  const savedScroll = useRef(0);

  useEffect(() => {
    const remember = () => {
      if (previous.current.page === "dashboard") {
        savedScroll.current = window.scrollY;
      }
    };
    const onHash = () => {
      const next = parseHash();
      if (next.page === "dashboard") {
        lastDashboardFocus.current = next.focused;
      }
      const returningFromPatient =
        previous.current.page === "patient" && next.page === "dashboard";
      previous.current = next;
      setRoute(next);
      requestAnimationFrame(() =>
        window.scrollTo({
          top: returningFromPatient ? savedScroll.current : 0,
        }),
      );
    };
    window.addEventListener("scroll", remember, { passive: true });
    window.addEventListener("hashchange", onHash);
    return () => {
      window.removeEventListener("hashchange", onHash);
      window.removeEventListener("scroll", remember);
    };
  }, []);

  const go = useCallback((r: Route) => {
    if (r.page === "patient") {
      window.location.hash = `/patient/${r.id}`;
    } else if (r.focused) {
      window.location.hash = `/focus/${r.focused}`;
    } else {
      window.location.hash = "/";
    }
  }, []);

  return [route, go, lastDashboardFocus];
}

function useUpdatedLabel(at: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);
  const mins = Math.floor((Math.max(now, at) - at) / 60_000);
  return mins < 1 ? "just now" : `${mins} min ago`;
}

export default function App() {
  const [patients, dispatch] = useReducer(reducer, undefined, initialPatients);
  const [route, go, lastDashboardFocus] = useRoute();
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<TableSort>({
    key: "priority",
    descending: false,
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [demoOpen, setDemoOpen] = useState(false);

  // Demo controls have no visible button: Alt+Shift+D (Option+Shift+D on Mac) opens them.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && e.shiftKey && e.code === "KeyD") {
        e.preventDefault();
        setDemoOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState(() => Date.now());
  const updatedLabel = useUpdatedLabel(updatedAt);
  const timers = useRef<number[]>([]);

  const rows = useMemo(() => buildRows(patients), [patients]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (fn: () => void, ms: number) =>
    timers.current.push(window.setTimeout(fn, ms));

  const dismissToast = useCallback(
    (id: string) => setToasts((t) => t.filter((x) => x.id !== id)),
    [],
  );
  const toast = useCallback(
    (t: Omit<Toast, "id">) => {
      const id = uid("toast");
      setToasts((list) => [...list.slice(-2), { ...t, id }]);
      later(() => dismissToast(id), 4500);
    },
    [dismissToast],
  );

  const simulate = (patientId: string, scenario: Scenario) => {
    const p = patients.find((x) => x.id === patientId);
    if (!p) return;
    const checkInId = uid(`${patientId}-sim`);
    dispatch({ type: "simulate", patientId, scenario, checkInId });
    setSelectedDate((cur) => (cur && cur !== DEMO_DATE ? null : cur));
    setUpdatedAt(Date.now());
    setFreshIds((s) => new Set([...s, checkInId]));
    setHighlightId(patientId);
    later(() => setHighlightId((h) => (h === patientId ? null : h)), 2800);
    later(
      () =>
        setFreshIds((s) => {
          const n = new Set(s);
          n.delete(checkInId);
          return n;
        }),
      6000,
    );
    const label = SCENARIOS.find((s) => s.id === scenario)!.label;
    const onProfile = route.page === "patient" && route.id === patientId;
    toast({
      title: `New check-in from ${p.name}`,
      body: `${
        p.contactMethod === "phone"
          ? "Automated call"
          : p.contactMethod === "caregiver"
            ? `Via ${p.caregiver?.name}`
            : "Text message"
      } · ${label}`,
      tone: "incoming",
      action: onProfile
        ? undefined
        : {
            label: "Open patient record",
            onClick: () => go({ page: "patient", id: patientId }),
          },
    });
  };

  const reset = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setToasts([]);
    setSort({ key: "priority", descending: false });
    dispatch({ type: "reset" });
    setFilters(EMPTY_FILTERS);
    setSelectedDate(null);
    setFreshIds(new Set());
    setHighlightId(null);
    setUpdatedAt(Date.now());
    toast({ title: "Demo reset", body: "Original sample data restored." });
  };

  const current =
    route.page === "patient"
      ? rows.find((r) => r.patient.id === route.id)
      : undefined;

  const handlers: ActionHandlers | null = current
    ? {
        log: (kind, text, msg) => {
          dispatch({ type: "log", patientId: current.patient.id, kind, text });
          toast({ title: msg });
        },
        resolve: (codes, readinessKeys, note) => {
          dispatch({
            type: "resolve",
            patientId: current.patient.id,
            codes,
            readinessKeys,
            note,
          });
          setUpdatedAt(Date.now());
          toast({ title: "Flag resolved", body: "Clinical status recalculated." });
        },
        saveNote: (text) => {
          dispatch({
            type: "notes",
            patientId: current.patient.id,
            notes: text,
          });
          toast({ title: "Clinical note saved" });
        },
      }
    : null;

  const isSubView =
    route.page === "patient" ||
    (route.page === "dashboard" && route.focused !== null);
  const isOverview = route.page === "dashboard" && route.focused === null;

  return (
    <Shell
      onHome={() => go({ page: "dashboard", focused: null })}
      isSubView={isSubView}
      isOverview={isOverview}
    >
      {route.page === "dashboard" ? (
        <DashboardWorkspace
          rows={rows}
          sort={sort}
          onSort={setSort}
          filters={filters}
          setFilters={setFilters}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          focused={route.focused}
          onFocusChange={(next) => go({ page: "dashboard", focused: next })}
          highlightId={highlightId}
          updatedLabel={updatedLabel}
          onOpenPatient={(id) => go({ page: "patient", id })}
        />
      ) : current && handlers ? (
        <PatientProfile
          key={current.patient.id}
          patient={current.patient}
          result={current.result}
          freshIds={freshIds}
          handlers={handlers}
          onBack={() =>
            go({ page: "dashboard", focused: lastDashboardFocus.current })
          }
        />
      ) : (
        <div className="border-y border-line py-16 text-center">
          <p className="text-[16px] font-semibold text-ink">
            Patient record not found.
          </p>
          <p className="mt-1 text-[13px] text-muted">
            The requested patient identifier is not in the sample waitlist.
          </p>
          <div className="mt-4">
            <Button
              variant="secondary"
              onClick={() => go({ page: "dashboard", focused: null })}
            >
              Return to surgical waitlist
            </Button>
          </div>
        </div>
      )}

      {demoOpen ? (
        <DemoPanel
          onClose={() => setDemoOpen(false)}
          patients={patients}
          defaultPatientId={route.page === "patient" ? route.id : null}
          onSimulate={simulate}
          onReset={reset}
        />
      ) : null}

      <Toasts toasts={toasts} dismiss={dismissToast} />
    </Shell>
  );
}
