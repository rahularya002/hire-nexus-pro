import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearSearchSession,
  getSearchSession,
  resetSearchSessionForTests,
  setActiveSearch,
  setSearchQuery,
} from "../search-session";

/**
 * Simulates the panel's lifecycle: switching Recruitment Memory tabs unmounts
 * the search panel, so "mounting" only reads the shared session and starts a
 * search when there is none.
 */
function mountPanel(startSearch: (query: string) => string) {
  const s = getSearchSession();
  if (!s.searchId && s.query.length >= 3) setActiveSearch(startSearch(s.query));
  return getSearchSession();
}

describe("search session persistence", () => {
  beforeEach(() => resetSearchSessionForTests());

  it("keeps the query and results after switching tabs and coming back", () => {
    setSearchQuery("fashion designers in Delhi");
    setActiveSearch("search-1");

    // tab switch -> panel unmounts -> panel remounts
    const after = getSearchSession();
    expect(after.query).toBe("fashion designers in Delhi");
    expect(after.searchId).toBe("search-1");
  });

  it("does not trigger a second AI/Gmail search on return", () => {
    const start = vi.fn((q: string) => `id-for-${q}`);
    setSearchQuery("backend engineers");
    setActiveSearch(start("backend engineers"));
    expect(start).toHaveBeenCalledTimes(1);

    mountPanel(start); // returning to the Mailbox tab
    mountPanel(start);
    expect(start).toHaveBeenCalledTimes(1);
    expect(getSearchSession().searchId).toBe("id-for-backend engineers");
  });

  it("stays cleared after an explicit Clear results, even across a remount", () => {
    setSearchQuery("hr generalists");
    setActiveSearch("search-2");
    clearSearchSession();

    const start = vi.fn((q: string) => `id-${q}`);
    const after = mountPanel(start);
    expect(after.query).toBe("");
    expect(after.searchId).toBeNull();
    expect(start).not.toHaveBeenCalled();
  });

  it("replaces the previous results when a new search starts", () => {
    setSearchQuery("first query");
    setActiveSearch("search-a");
    setSearchQuery("second query");
    setActiveSearch("search-b");

    expect(getSearchSession()).toEqual({ query: "second query", searchId: "search-b" });
  });

  it("re-opening a recent search adopts both its id and its text", () => {
    setActiveSearch("search-old", "designers with 5 years");
    expect(getSearchSession()).toEqual({ query: "designers with 5 years", searchId: "search-old" });
  });
});
