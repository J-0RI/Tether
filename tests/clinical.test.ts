import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateStatus, daysSinceReply } from "../src/calculateStatus";
import { initialPatients } from "../src/mockData";
import { reducer } from "../src/state";
import {
  buildCheckInFeed,
  buildRows,
  computeOperationalMetrics,
  computePatientTrends,
  computeStats,
  hasReadinessGap,
  readinessBreakdown,
  readinessCount,
  recommendedFollowUp,
} from "../src/lib/derive";
import { daysAgo, daysFromNow, demoNow } from "../src/lib/dates";
import {
  buildCalendarEventMap,
  buildMonthGrid,
  buildTwoWeekGrid,
  defaultCalendarMonday,
  prioritizeUpcomingSurgeries,
  recentCheckInDates,
} from "../src/lib/calendar";
import { safetyResponse } from "../src/lib/safety";
import type { Answers, Patient } from "../src/types";
function clean(): Patient {
  const p = initialPatients().find((p) => p.id === "james-lee")!;
  return {
    ...p,
    surgeryDate: null,
    resolved: [],
    readiness: p.readiness.map((r) => ({ ...r, state: "done" })),
    baseline: { pain: 3, walk: 7, mood: "Good" },
    checkIns: [
      {
        id: "test",
        date: daysAgo(1),
        time: "9:00 AM",
        channel: "text",
        answers: {
          worse: false,
          pain: 3,
          walk: 7,
          mood: "Good",
          info: true,
          help: false,
          wants: true,
        },
      },
    ],
  };
}
function answer(changes: Partial<Answers>): Patient {
  const p = clean();
  p.checkIns[0].answers = { ...p.checkIns[0].answers!, ...changes };
  return p;
}
test("reproducible initial population, counts, and risk ordering", () => {
  const rows = buildRows(initialPatients());
  assert.deepEqual(computeStats(rows), {
    total: 12,
    act: 2,
    watch: 4,
    ok: 6,
    noReply: 1,
    surgeriesSoon: 1,
  });
  assert.equal(rows[0].patient.id, "robert-bird");
  assert.equal(rows[1].patient.id, "grace-ahenakew");
});
test("fixed reference date and surgery offsets", () => {
  assert.equal(daysFromNow(0), "2026-11-07");
  assert.equal(daysFromNow(3), "2026-11-10");
  assert.equal(daysAgo(14), "2026-10-24");
  assert.equal(demoNow().getFullYear(), 2026);
});
test("pain threshold is inclusive at 2 points", () => {
  assert.equal(calculateStatus(answer({ pain: 4 })).status, "ok");
  assert.equal(calculateStatus(answer({ pain: 5 })).status, "watch");
});
test("mobility threshold is inclusive at 3 days", () => {
  assert.equal(calculateStatus(answer({ walk: 5 })).status, "ok");
  assert.equal(calculateStatus(answer({ walk: 4 })).status, "watch");
});
test("two consecutive low moods required", () => {
  const p = answer({ mood: "Low" });
  assert.equal(calculateStatus(p).status, "ok");
  p.checkIns.unshift({ ...p.checkIns[0], id: "prior", date: daysAgo(15) });
  assert.equal(calculateStatus(p).status, "watch");
});
test("no reply threshold and never-answered handling", () => {
  const p = clean();
  p.checkIns[0].date = daysAgo(13);
  assert.equal(calculateStatus(p).status, "ok");
  p.checkIns[0].date = daysAgo(14);
  assert.equal(calculateStatus(p).status, "watch");
  assert.equal(daysSinceReply(p), 14);
  p.checkIns = [];
  assert.equal(calculateStatus(p).status, "watch");
});
test("information and explicit assistance requests flag Watch", () => {
  assert.equal(calculateStatus(answer({ info: false })).status, "watch");
  assert.equal(calculateStatus(answer({ help: true })).status, "watch");
});
test("surgery preference overrides Watch without cancelling surgery", () => {
  const p = answer({ wants: false, pain: 8 });
  p.surgeryDate = daysFromNow(19);
  assert.equal(calculateStatus(p).status, "act");
  assert.equal(p.surgeryDate, "2026-11-26");
});
test("red flags override Watch and carry emergency-safe text", () => {
  const p = answer({ pain: 8 });
  p.checkIns[0].redFlag = "chest pain";
  assert.equal(calculateStatus(p).status, "act");
  assert.match(safetyResponse("chest pain"), /911 immediately/);
  assert.match(
    safetyResponse("fever"),
    /Please call HealthLine 811 or go to emergency\./,
  );
});
test("readiness window includes today and 7 days but not day 8 or the past", () => {
  for (const [days, status] of [
    [0, "act"],
    [7, "act"],
    [8, "ok"],
    [-1, "ok"],
  ] as const) {
    const p = clean();
    p.surgeryDate = daysFromNow(days);
    p.readiness.find((r) => r.key === "ride")!.state = "missing";
    assert.equal(calculateStatus(p).status, status);
  }
});
test("not applicable and not due items do not create missing-item flags", () => {
  const p = clean();
  p.surgeryDate = daysFromNow(3);
  p.readiness[0].state = "na";
  p.readiness[1].state = "notdue";
  assert.equal(calculateStatus(p).status, "ok");
  assert.deepEqual(readinessCount(p.readiness), { ready: 7, total: 8 });
});
test("incoming response changes every derived representation from the same patient state", () => {
  let state = initialPatients();
  state = reducer(state, {
    type: "simulate",
    patientId: "james-lee",
    scenario: "pain-worse",
    checkInId: "incoming",
  });
  const p = state.find((p) => p.id === "james-lee")!;
  assert.equal(p.checkIns.at(-1)?.answers?.pain, 8);
  assert.equal(p.checkIns.at(-1)?.answers?.walk, 0);
  assert.equal(p.checkIns.at(-1)?.date, "2026-11-07");
  assert.equal(calculateStatus(p).status, "watch");
  assert.equal(computeStats(buildRows(state)).watch, 5);
  assert.equal(computeStats(buildRows(state)).ok, 5);
  assert.equal(p.activity.at(-1)?.kind, "checkin");
  assert.ok(
    buildRows(state).findIndex((r) => r.patient.id === p.id) <
      buildRows(state).findIndex((r) => r.patient.id === "helen-kowalchuk"),
  );
});
test("all five scenarios produce consistent records", () => {
  for (const scenario of [
    "pain-worse",
    "no-ride",
    "not-wanting",
    "all-good",
    "red-flag",
  ] as const) {
    const p = reducer([clean()], {
      type: "simulate",
      patientId: "james-lee",
      scenario,
      checkInId: scenario,
    })[0];
    assert.equal(p.checkIns.at(-1)?.simulated, true);
    assert.equal(
      calculateStatus(p).status,
      scenario === "all-good"
        ? "ok"
        : scenario === "not-wanting" || scenario === "red-flag"
          ? "act"
          : "watch",
    );
  }
});
test("follow-ups and reviews do not clear flags", () => {
  let p = initialPatients().find((p) => p.id === "robert-bird")!;
  for (const kind of ["call", "refer", "video", "review"] as const) {
    p = reducer([p], {
      type: "log",
      patientId: p.id,
      kind,
      text: "Simulated follow-up",
    })[0];
    assert.equal(calculateStatus(p).status, "act");
    assert.equal(p.readiness.find((r) => r.key === "ride")?.state, "missing");
  }
});
test("explicit readiness confirmation recalculates remaining flags", () => {
  const p = initialPatients().find((p) => p.id === "robert-bird")!;
  const next = reducer([p], {
    type: "resolve",
    patientId: p.id,
    codes: ["readiness:ride"],
    readinessKeys: ["ride"],
    note: "Sister confirmed ride",
  })[0];
  assert.equal(next.readiness.find((r) => r.key === "ride")?.state, "done");
  assert.equal(calculateStatus(next).status, "watch");
  assert.ok(calculateStatus(next).reasons.some((r) => r.code === "needs-help"));
});
test("resolved signals reappear on a newer concerning response", () => {
  let p = answer({ pain: 8 });
  p = reducer([p], {
    type: "resolve",
    patientId: p.id,
    codes: ["pain-up"],
    readinessKeys: [],
    note: "Assessed and plan documented",
  })[0];
  assert.equal(calculateStatus(p).status, "ok");
  p = reducer([p], {
    type: "simulate",
    patientId: p.id,
    scenario: "pain-worse",
    checkInId: "newer",
  })[0];
  assert.equal(calculateStatus(p).status, "watch");
});
test("notes are attributed, retained chronologically, and reset with all mutations", () => {
  let state = initialPatients();
  for (const notes of ["First note", "Second note"])
    state = reducer(state, { type: "notes", patientId: "james-lee", notes });
  const p = state.find((p) => p.id === "james-lee")!;
  assert.equal(p.activity.at(-1)?.text, "Note: Second note");
  assert.match(p.activity.at(-1)!.by, /K. Ross/);
  assert.equal(new Date(p.activity.at(-1)!.at).getDate(), 7);
  state = reducer(state, {
    type: "simulate",
    patientId: p.id,
    scenario: "red-flag",
    checkInId: "reset-me",
  });
  assert.deepEqual(reducer(state, { type: "reset" }), initialPatients());
});

test("operational metrics and readiness breakdown reflect unified dashboard cohorts", () => {
  const rows = buildRows(initialPatients());
  const metrics = computeOperationalMetrics(rows);
  assert.equal(metrics.attention, 6);
  assert.equal(metrics.scheduled, 7);
  assert.equal(metrics.readinessGaps, 4);
  assert.equal(metrics.scheduledReadinessGaps, 2);
  assert.equal(metrics.simulatedCount, 0);

  const robert = rows.find((r) => r.patient.id === "robert-bird")!.patient;
  assert.equal(hasReadinessGap(robert), true);
  assert.deepEqual(readinessBreakdown(robert.readiness), {
    ready: 8,
    missing: 1,
    notDue: 0,
    na: 0,
    total: 9,
  });

  const grace = rows.find((r) => r.patient.id === "grace-ahenakew")!.patient;
  assert.deepEqual(readinessBreakdown(grace.readiness), {
    ready: 6,
    missing: 1,
    notDue: 2,
    na: 0,
    total: 9,
  });

  const james = rows.find((r) => r.patient.id === "james-lee")!.patient;
  assert.equal(readinessBreakdown(james.readiness).na, 1);
  assert.equal(readinessBreakdown(james.readiness).total, 8);
});

test("patient trend model prioritizes flagged clinical metric and groups consecutive Low moods", () => {
  const patients = initialPatients();
  const mary = patients.find((p) => p.id === "mary-thompson")!;
  const maryTrends = computePatientTrends(mary);
  assert.equal(maryTrends.primaryMetric, "pain");
  assert.equal(maryTrends.pain.flagged, true);
  assert.equal(maryTrends.pain.delta, 3);
  assert.equal(maryTrends.walk.flagged, true);
  assert.equal(maryTrends.walk.current, 0);

  const frank = patients.find((p) => p.id === "frank-olson")!;
  const frankTrends = computePatientTrends(frank);
  assert.equal(frankTrends.primaryMetric, "mood");
  assert.equal(frankTrends.mood.flagged, true);
  assert.equal(frankTrends.mood.consecutiveLow, 2);
  const groupedCount = frankTrends.observations.filter(
    (o) => o.consecutiveLowGroup,
  ).length;
  assert.equal(groupedCount, 2);
});

test("check-in feed and recommended follow-up classify urgent, missed, and clinical events", () => {
  const rows = buildRows(initialPatients());
  const feed = buildCheckInFeed(rows);
  assert.ok(feed.length > 12);

  const graceLatest = feed.find(
    (f) => f.patient.id === "grace-ahenakew" && f.isLatestForPatient,
  )!;
  assert.equal(graceLatest.category, "urgent");

  const daljitLatest = feed.find(
    (f) => f.patient.id === "daljit-kaur" && f.isLatestForPatient,
  )!;
  assert.equal(daljitLatest.category, "missed");

  const robertRow = rows.find((r) => r.patient.id === "robert-bird")!;
  assert.match(
    recommendedFollowUp(robertRow.patient, robertRow.result),
    /ride home/i,
  );
});

test("calendar event map reflects real surgery and check-in dates with zero fabricated markers", () => {
  const rows = buildRows(initialPatients());
  const feed = buildCheckInFeed(rows);
  const eventMap = buildCalendarEventMap(rows, feed);

  // Nov 10: Joshua Bird surgery with missing ride home
  const nov10 = eventMap.get("2026-11-10");
  assert.ok(nov10);
  assert.equal(nov10.surgeries.length, 1);
  assert.equal(nov10.surgeries[0].patientId, "robert-bird");
  assert.equal(nov10.hasReadinessIssue, true);

  // Nov 19: Helen Kowalchuk cataract surgery, readiness confirmed
  const nov19 = eventMap.get("2026-11-19");
  assert.ok(nov19);
  assert.equal(nov19.surgeries[0].patientId, "helen-kowalchuk");
  assert.equal(nov19.hasReadinessIssue, false);

  // Nov 26: Grace Yousef knee surgery, surgical preference requires confirmation
  const nov26 = eventMap.get("2026-11-26");
  assert.ok(nov26);
  assert.equal(nov26.surgeries[0].patientId, "grace-ahenakew");
  assert.equal(nov26.hasReadinessIssue, true);

  // Nov 6: 4 real latest check-ins (Telot, Frank, Grace, Priya)
  const nov6 = eventMap.get("2026-11-06");
  assert.ok(nov6);
  assert.equal(nov6.checkIns.length, 4);
  assert.equal(nov6.hasUrgentCheckIn, true);

  // Unscheduled / empty date (Nov 11) has no fabricated markers
  assert.equal(eventMap.get("2026-11-11"), undefined);

  // Default 2-week grid starts Monday Nov 2, 2026 and highlights 7-day pre-op window Nov 7..Nov 13
  const twoWeeks = buildTwoWeekGrid(defaultCalendarMonday(), eventMap, "schedule");
  assert.equal(twoWeeks.length, 2);
  assert.equal(twoWeeks[0][0].date, "2026-11-02");
  assert.equal(twoWeeks[0][5].date, "2026-11-07");
  assert.equal(twoWeeks[0][5].isToday, true);
  assert.equal(twoWeeks[0][5].bandTone, "imminent");
  assert.equal(twoWeeks[1][4].date, "2026-11-13");
  assert.equal(twoWeeks[1][4].bandTone, "imminent");
  assert.equal(twoWeeks[1][5].bandTone, null);

  // Month grid for Nov 2026 covers Nov 1 through Nov 30
  const novGrid = buildMonthGrid(2026, 10, eventMap, "schedule");
  assert.ok(novGrid.flat().some((c) => c.date === "2026-11-01" && c.inCurrentPeriod));
  assert.ok(novGrid.flat().some((c) => c.date === "2026-11-30" && c.inCurrentPeriod));
});

test("upcoming surgery prioritization and simulated check-in calendar updates stay consistent", () => {
  const initial = initialPatients();
  const rows = buildRows(initial);
  const top3 = prioritizeUpcomingSurgeries(rows, 3);
  assert.deepEqual(
    top3.map((r) => r.patient.id),
    ["robert-bird", "helen-kowalchuk", "grace-ahenakew"],
  );

  // Simulate check-in on demo today (2026-11-07) and verify calendar & recent dates update
  const nextState = reducer(initial, {
    type: "simulate",
    patientId: "helen-kowalchuk",
    scenario: "no-ride",
    checkInId: "helen-sim",
  });
  const nextRows = buildRows(nextState);
  const nextFeed = buildCheckInFeed(nextRows);
  const nextMap = buildCalendarEventMap(nextRows, nextFeed);
  assert.equal(recentCheckInDates(nextFeed, 4)[0], "2026-11-07");
  assert.equal(nextMap.get("2026-11-07")?.checkIns.length, 1);
  assert.equal(nextMap.get("2026-11-19")?.hasReadinessIssue, true);
});
