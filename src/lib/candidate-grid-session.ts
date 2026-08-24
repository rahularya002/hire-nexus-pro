// Candidate Grid session. Filters, the text query and the natural-language
// search that produced the current view must survive opening a candidate and
// coming back (and route changes), so they live in a tiny module-level store
// rather than component state — same pattern as the mailbox search session.
import { useSyncExternalStore } from "react";

export type GridFilters = {
  /** Quick text match across name / role / company / email / skills. */
  q: string;
  role: string;
  company: string;
  location: string;
  skills: string;
  industry: string;
  noticePeriod: string;
  minYears: string;
  ctcMin: string;
  ctcMax: string;
  expectedMax: string;
  source: string;
  status: string;
  owner: string;
  client: string;
};

export type GridSession = {
  filters: GridFilters;
  /** Committed natural-language query whose results are on screen. */
  nlQuery: string;
  /** Candidate whose detail sheet was last opened, so it can be restored. */
  openCandidateId: string | null;
};

export const EMPTY_FILTERS: GridFilters = {
  q: "",
  role: "",
  company: "",
  location: "",
  skills: "",
  industry: "",
  noticePeriod: "",
  minYears: "",
  ctcMin: "",
  ctcMax: "",
  expectedMax: "",
  source: "all",
  status: "all",
  owner: "all",
  client: "all",
};

const EMPTY: GridSession = { filters: EMPTY_FILTERS, nlQuery: "", openCandidateId: null };

let session: GridSession = EMPTY;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const getGridSession = (): GridSession => session;

export function setGridFilters(patch: Partial<GridFilters>) {
  session = { ...session, filters: { ...session.filters, ...patch } };
  emit();
}

export function resetGridFilters() {
  session = { ...session, filters: EMPTY_FILTERS };
  emit();
}

export function setGridNlQuery(nlQuery: string) {
  if (session.nlQuery === nlQuery) return;
  session = { ...session, nlQuery };
  emit();
}

export function setGridOpenCandidate(openCandidateId: string | null) {
  if (session.openCandidateId === openCandidateId) return;
  session = { ...session, openCandidateId };
  emit();
}

/** Test-only helper so specs start from a clean slate. */
export function resetGridSessionForTests() {
  session = EMPTY;
  listeners.clear();
}

export function useGridSession(): GridSession {
  return useSyncExternalStore(subscribe, getGridSession, getGridSession);
}

/** True when any filter differs from its default — drives the Clear button. */
export function hasActiveFilters(f: GridFilters): boolean {
  return Object.entries(f).some(([k, v]) => v !== (EMPTY_FILTERS as Record<string, string>)[k]);
}
