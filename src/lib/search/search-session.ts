// Recruitment Memory search session.
//
// The Mailbox / Candidate archive switch unmounts the search panel, so the
// recruiter's query and the id of the search they are looking at cannot live in
// component state — they'd be wiped by a tab switch. This tiny module-level
// store keeps that session alive for the lifetime of the page (no backend, no
// database), while the results themselves stay in the React Query cache keyed by
// the search id. Only committed state lives here: never loading or error flags.
import { useSyncExternalStore } from "react";

export type SearchSession = {
  /** What the recruiter typed. Survives tab switches. */
  query: string;
  /** The search whose results are on screen, or null when there are none. */
  searchId: string | null;
};

const EMPTY: SearchSession = { query: "", searchId: null };

let session: SearchSession = EMPTY;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSearchSession(): SearchSession {
  return session;
}

export function setSearchQuery(query: string) {
  if (session.query === query) return;
  session = { ...session, query };
  emit();
}

/** Point the panel at a search (new run, or a recent search re-opened). */
export function setActiveSearch(searchId: string, query?: string) {
  session = { query: query ?? session.query, searchId };
  emit();
}

/** Explicit "Clear results" — wipes query and results together. */
export function clearSearchSession() {
  if (session === EMPTY) return;
  session = EMPTY;
  emit();
}

/** Test-only helper so specs start from a clean slate. */
export function resetSearchSessionForTests() {
  session = EMPTY;
  listeners.clear();
}

export function useSearchSession(): SearchSession {
  return useSyncExternalStore(subscribe, getSearchSession, getSearchSession);
}
