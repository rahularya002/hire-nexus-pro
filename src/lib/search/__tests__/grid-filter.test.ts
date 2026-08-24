import { describe, expect, it } from "vitest";
import { matchesGridFilters, type FilterableCandidate } from "@/lib/candidate-grid-filter";
import { EMPTY_FILTERS, hasActiveFilters, type GridFilters } from "@/lib/candidate-grid-session";

const ME = "11111111-1111-1111-1111-111111111111";

const cand = (over: Partial<FilterableCandidate> = {}): FilterableCandidate => ({
  name: "Anita Rao",
  email: "anita@example.com",
  phone: "+91 98765 43210",
  role: "Fashion Designer",
  current_company: "Zara",
  previous_companies: ["H&M"],
  location: "Mumbai",
  industry: "Apparel",
  notice_period: "30 days",
  skills: ["draping", "illustration"],
  experience: "7 years",
  relevant_experience: "5 years",
  current_ctc: 12,
  expected_ctc: 18,
  salary_min: null,
  salary_max: null,
  source: "inbound",
  status: "new",
  owner_id: ME,
  source_client_id: null,
  ...over,
});

const f = (over: Partial<GridFilters> = {}): GridFilters => ({ ...EMPTY_FILTERS, ...over });
const ok = (c: FilterableCandidate, over: Partial<GridFilters>) => matchesGridFilters(c, f(over), ME);

describe("candidate grid filters", () => {
  it("default filters keep every candidate and report no active filter", () => {
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false);
    expect(matchesGridFilters(cand(), EMPTY_FILTERS, ME)).toBe(true);
    expect(matchesGridFilters(cand({ role: null, location: null, current_ctc: null }), EMPTY_FILTERS, ME)).toBe(true);
  });

  it("matches designation, location, industry and notice period case-insensitively", () => {
    expect(ok(cand(), { role: "fashion" })).toBe(true);
    expect(ok(cand(), { role: "graphic" })).toBe(false);
    expect(ok(cand(), { location: "mumbai" })).toBe(true);
    expect(ok(cand(), { industry: "apparel" })).toBe(true);
    expect(ok(cand(), { noticePeriod: "30" })).toBe(true);
  });

  it("company filter also matches past employers", () => {
    expect(ok(cand(), { company: "zara" })).toBe(true);
    expect(ok(cand(), { company: "h&m" })).toBe(true);
    expect(ok(cand(), { company: "infosys" })).toBe(false);
  });

  it("skills filter requires every requested skill", () => {
    expect(ok(cand(), { skills: "draping" })).toBe(true);
    expect(ok(cand(), { skills: "draping, illustration" })).toBe(true);
    expect(ok(cand(), { skills: "draping, figma" })).toBe(false);
  });

  it("combines filters and clears back to the full set", () => {
    const c = cand();
    expect(ok(c, { role: "fashion", location: "Mumbai", minYears: "3", status: "new" })).toBe(true);
    expect(ok(c, { role: "fashion", location: "Delhi", minYears: "3" })).toBe(false);
    expect(matchesGridFilters(c, EMPTY_FILTERS, ME)).toBe(true);
  });

  it("treats unknown values as excluded for numeric ranges, never as zero", () => {
    expect(ok(cand({ current_ctc: null, salary_min: null, salary_max: null }), { ctcMin: "5" })).toBe(false);
    expect(ok(cand({ experience: null, relevant_experience: null }), { minYears: "3" })).toBe(false);
    expect(ok(cand({ expected_ctc: null, salary_max: null }), { expectedMax: "20" })).toBe(false);
  });

  it("falls back to the salary range when canonical CTC is unknown", () => {
    expect(ok(cand({ current_ctc: null, salary_min: 10, salary_max: 14 }), { ctcMin: "8", ctcMax: "12" })).toBe(true);
  });

  it("ignores non-numeric filter text instead of dropping everyone", () => {
    expect(ok(cand(), { minYears: "abc", ctcMin: "n/a", expectedMax: "" })).toBe(true);
  });

  it("filters by source, status, owner and source client", () => {
    expect(ok(cand(), { source: "inbound" })).toBe(true);
    expect(ok(cand(), { source: "manual" })).toBe(false);
    expect(ok(cand({ status: "placed" }), { status: "new" })).toBe(false);
    expect(ok(cand(), { owner: "mine" })).toBe(true);
    expect(ok(cand({ owner_id: null }), { owner: "mine" })).toBe(false);
    expect(ok(cand({ owner_id: null }), { owner: "unassigned" })).toBe(true);
    expect(ok(cand(), { client: "unassigned" })).toBe(true);
    expect(ok(cand({ source_client_id: "abc" }), { client: "unassigned" })).toBe(false);
    expect(ok(cand({ source_client_id: "abc" }), { client: "abc" })).toBe(true);
  });

  it("quick find spans name, email, company, phone, industry and skills", () => {
    expect(ok(cand(), { q: "anita" })).toBe(true);
    expect(ok(cand(), { q: "example.com" })).toBe(true);
    expect(ok(cand(), { q: "zara" })).toBe(true);
    expect(ok(cand(), { q: "draping" })).toBe(true);
    expect(ok(cand(), { q: "nonexistent" })).toBe(false);
  });
});
