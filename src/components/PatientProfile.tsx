import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Patient, StatusResult } from "../types";
import { ActionModals, type ActionHandlers, type ActionModalKind } from "./ActionsPanel";
import { CheckInHistory } from "./profile/CheckInHistory";
import { ClinicalContext } from "./profile/ClinicalContext";
import { ClinicalReview } from "./profile/ClinicalReview";
import { historyStatuses } from "./profile/clinical";
import {
  CondensedIdentity,
  FollowUpModal,
  IdentityHeader,
  PatientToolbar,
  type ToolbarTarget,
} from "./profile/WorkspaceHeader";

const ANCHOR: Record<Exclude<ToolbarTarget, "summary">, string> = {
  checkins: "pw-checkins",
  readiness: "pw-readiness",
  medical: "pw-medical",
  notes: "pw-notes",
};

/**
 * Patient workspace: identity and surgical context on top, then three coordinated regions —
 * check-in history (A), the selected record under review (B), readiness and medical context (C) —
 * and a patient-context toolbar pinned to the bottom of the viewport.
 */
export function PatientProfile({
  patient: p,
  result,
  freshIds,
  handlers,
  onBack,
}: {
  patient: Patient;
  result: StatusResult;
  freshIds: Set<string>;
  handlers: ActionHandlers;
  onBack: () => void;
}) {
  // null follows the newest check-in, so a simulated arrival appears without losing a pinned historical view
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [modal, setModal] = useState<ActionModalKind>(null);
  const [followUp, setFollowUp] = useState(false);
  const [composeRequest, setComposeRequest] = useState(0);
  const [activeNav, setActiveNav] = useState<ToolbarTarget>("summary");
  const statuses = useMemo(() => historyStatuses(p), [p]);

  const latestId = p.checkIns.at(-1)!.id;
  const selectedId = pinnedId && p.checkIns.some((c) => c.id === pinnedId) ? pinnedId : latestId;
  const select = (id: string) => setPinnedId(id === latestId ? null : id);

  const headerRef = useRef<HTMLDivElement>(null);
  const [chromeH, setChromeH] = useState(80);
  const [condensed, setCondensed] = useState(false);

  // Track the sticky global chrome so the sticky history and condensed identity sit just below it.
  useLayoutEffect(() => {
    const chrome = document.querySelector<HTMLElement>(".global-chrome");
    if (!chrome) return;
    const update = () => setChromeH(chrome.offsetHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(chrome);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setCondensed(!e.isIntersecting), {
      rootMargin: `-${chromeH}px 0px 0px 0px`,
    });
    io.observe(el);
    return () => io.disconnect();
  }, [chromeH]);

  // Back at the top of the record, the toolbar returns to Summary.
  useEffect(() => {
    const onScroll = () => window.scrollY < 24 && setActiveNav("summary");
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navigate = (t: ToolbarTarget) => {
    setActiveNav(t);
    // Jump rather than animate: the highlight below shows where focus landed.
    if (t === "summary") {
      window.scrollTo({ top: 0 });
      headerRef.current?.querySelector("h1")?.focus({ preventScroll: true });
      return;
    }
    const el = document.getElementById(ANCHOR[t]);
    if (!el) return;
    el.scrollIntoView({ block: "start" });
    el.focus({ preventScroll: true });
    el.classList.remove("pw-flash");
    void el.offsetWidth; // restart the highlight animation
    el.classList.add("pw-flash");
  };

  return (
    <div className="pw-root" style={{ "--pw-top": `${chromeH}px` } as React.CSSProperties}>
      <CondensedIdentity p={p} result={result} visible={condensed} onBack={onBack} />

      <div ref={headerRef}>
        <IdentityHeader p={p} result={result} onBack={onBack} />
      </div>

      <div className="pw-grid mt-4">
        <div className="pw-region-history flex min-h-0 flex-col">
          <CheckInHistory patient={p} statuses={statuses} selectedId={selectedId} onSelect={select} freshIds={freshIds} />
        </div>
        <div className="pw-region-review min-w-0">
          <ClinicalReview
            patient={p}
            result={result}
            statuses={statuses}
            selectedId={selectedId}
            onSelect={select}
            handlers={handlers}
            composeRequest={composeRequest}
          />
        </div>
        <div className="pw-region-context min-w-0">
          <ClinicalContext patient={p} handlers={handlers} />
        </div>
      </div>

      <PatientToolbar
        p={p}
        result={result}
        active={activeNav}
        onNavigate={navigate}
        onFollowUp={() => setFollowUp(true)}
        onAddNote={() => {
          setComposeRequest((n) => n + 1);
          navigate("notes");
        }}
        onModal={setModal}
        handlers={handlers}
      />

      <ActionModals modal={modal} onClose={() => setModal(null)} patient={p} result={result} handlers={handlers} />
      {followUp ? (
        <FollowUpModal
          p={p}
          result={result}
          onClose={() => setFollowUp(false)}
          onSave={(text) => {
            handlers.log("followup", text, "Follow-up recorded in demo");
            setFollowUp(false);
          }}
        />
      ) : null}
    </div>
  );
}
