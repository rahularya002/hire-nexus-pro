import { describe, expect, it } from "vitest";
import { deterministicPlan } from "../query-plan.server";
import { rankItem, type RankInput } from "../rank.server";

const input = (over: Partial<RankInput> & { haystack: string }): RankInput => ({
  extracted: {} as never,
  confidence: 90,
  hasResume: true,
  sentAt: new Date().toISOString(),
  ...over,
});

describe("deterministic plan", () => {
  it("keeps the occupation and drops seniority as a keyword", () => {
    const plan = deterministicPlan("Senior fashion designers in Delhi with 4+ years");
    expect(plan.roles).toContain("fashion designer");
    expect(plan.keywords).not.toContain("senior");
    expect(plan.minYears).toBe(4);
    expect(plan.locations).toContain("delhi");
  });
});

describe("rankItem role gating", () => {
  const plan = deterministicPlan("Senior fashion designers in Delhi with 4+ years");

  it("rejects a Sales Associate in Delhi with 9 years", () => {
    const r = rankItem(plan, input({
      extracted: { role: "Sales Associate", location: "Delhi", experience: "9 years", skills: ["retail"] } as never,
      haystack: "senior sales associate delhi 9 years retail",
    }));
    expect(r.qualified).toBe(false);
    expect(r.score).toBe(0);
    expect(r.parts.matched).not.toContain("senior");
  });

  it("ranks an explicit Fashion Designer in Delhi highly", () => {
    const r = rankItem(plan, input({
      extracted: { role: "Senior Fashion Designer", location: "New Delhi", experience: "5 years", skills: ["fashion design", "textiles"] } as never,
      haystack: "senior fashion designer new delhi 5 years textiles sketching",
    }));
    expect(r.qualified).toBe(true);
    expect(r.score).toBeGreaterThan(60);
  });

  it("uses attachment role evidence when the subject lacks the phrase", () => {
    const r = rankItem(plan, input({
      extracted: { role: "Fashion Designer", location: "Delhi", experience: "4 years" } as never,
      haystack: "resume attached fashion designer delhi 4 years",
    }));
    expect(r.qualified).toBe(true);
  });
});

describe("rankItem other queries", () => {
  it("rejects a Bangalore-only match for React developers in Bangalore", () => {
    const plan = deterministicPlan("React developers in Bangalore");
    const r = rankItem(plan, input({
      extracted: { role: "Accountant", location: "Bangalore", experience: "6 years", skills: ["tally"] } as never,
      haystack: "accountant bangalore tally 6 years",
    }));
    expect(r.qualified).toBe(false);
  });

  it("still allows location-only matching for a broad query", () => {
    const plan = deterministicPlan("candidates in Delhi");
    expect(plan.roles).toHaveLength(0);
    const r = rankItem(plan, input({
      extracted: { role: "Sales Associate", location: "Delhi", experience: "9 years" } as never,
      haystack: "sales associate delhi",
    }));
    expect(r.qualified).toBe(true);
    expect(r.score).toBeGreaterThan(30);
  });
});
