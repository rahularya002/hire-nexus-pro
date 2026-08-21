import { describe, expect, it } from "vitest";
import { deterministicPlan } from "../query-plan.server";
import { rankItem, type RankInput } from "../rank.server";
import { occupationRequirement, matchOccupation } from "../occupation";
import { dedupeHits } from "../dedupe";

const input = (over: Partial<RankInput> & { haystack: string }): RankInput => ({
  extracted: {} as never,
  confidence: 90,
  hasResume: true,
  sentAt: new Date().toISOString(),
  ...over,
});

const FASHION = "Fashion designers with 3+ years experience in Delhi or Mumbai";

describe("occupation parsing", () => {
  it("keeps a multi-word occupation atomic", () => {
    const req = occupationRequirement(deterministicPlan(FASHION).roles);
    expect(req.specificity).toBe("specific");
    expect(req.specs[0]?.phrase).toBe("fashion designer");
  });

  it("treats a lone head noun as a generic requirement", () => {
    const req = occupationRequirement(deterministicPlan("designers in Delhi").roles);
    expect(req.specificity).toBe("generic");
  });

  it("does not accept generic designer for a fashion designer query", () => {
    const req = occupationRequirement(deterministicPlan(FASHION).roles);
    expect(matchOccupation(req, { role: "Graphic Designer", skills: ["figma"] }).tier).toBe("generic");
    expect(matchOccupation(req, { role: "Fashion Designer" }).tier).toBe("specific");
    expect(matchOccupation(req, { role: "Apparel Designer" }).tier).toBe("specific");
    expect(matchOccupation(req, { role: "Womenswear Designer" }).tier).toBe("specific");
  });
});

describe("fashion designer query — screenshot regression", () => {
  const plan = deterministicPlan(FASHION);
  const run = (extracted: Record<string, unknown>, haystack: string) =>
    rankItem(plan, input({ extracted: extracted as never, haystack }));

  it("Fashion Designer · 7 years · Mumbai is a strong match", () => {
    const r = run(
      { role: "Fashion Designer", location: "Mumbai", experience: "7 years", skills: ["draping", "illustration"] },
      "fashion designer mumbai 7 years draping",
    );
    expect(r.qualified).toBe(true);
    expect(r.score).toBeGreaterThan(60);
  });

  it("Apparel Designer · 5 years · Delhi matches", () => {
    const r = run({ role: "Apparel Designer", location: "Delhi", experience: "5 years" }, "apparel designer delhi");
    expect(r.qualified).toBe(true);
    expect(r.score).toBeGreaterThan(50);
  });

  it("Womenswear Designer · 6 years · Mumbai matches", () => {
    const r = run({ role: "Womenswear Designer", location: "Mumbai", experience: "6 years" }, "womenswear designer mumbai");
    expect(r.qualified).toBe(true);
  });

  it("rejects Graphic Designer · 8 years · Mumbai · Figma", () => {
    const r = run(
      { role: "Graphic Designer", location: "Mumbai", experience: "8 years", skills: ["figma", "photoshop"] },
      "graphic designer mumbai figma photoshop wireframing 8 years",
    );
    expect(r.qualified).toBe(false);
    expect(r.score).toBe(0);
  });

  it("rejects UX Designer · 6 years · Delhi · Figma", () => {
    const r = run(
      { role: "UX Designer", location: "Delhi", experience: "6 years", skills: ["figma", "wireframing"] },
      "ux designer delhi figma wireframing",
    );
    expect(r.qualified).toBe(false);
  });

  it("rejects Sales Associate · 9 years · Delhi", () => {
    const r = run({ role: "Sales Associate", location: "Delhi", experience: "9 years", skills: ["sales", "excel"] }, "sales associate delhi excel");
    expect(r.qualified).toBe(false);
  });

  it("rejects Software Engineer · 7 years · Mumbai with Spring/Express", () => {
    const r = run(
      { role: "Software Engineer", location: "Mumbai", experience: "7 years", skills: ["spring", "express"] },
      "software engineer mumbai spring boot express 7 years",
    );
    expect(r.qualified).toBe(false);
  });

  it("rejects a missing role with only Figma / wireframing skills", () => {
    const r = run({ role: null, location: "Mumbai", experience: "4 years", skills: ["figma", "wireframing"] }, "figma wireframing mumbai 4 years");
    expect(r.qualified).toBe(false);
  });

  it("accepts fashion evidence from the resume text when the title is empty", () => {
    const r = run({ role: null, location: "Delhi", experience: "4 years" }, "resume of a fashion designer in delhi with 4 years in womenswear");
    expect(r.qualified).toBe(true);
  });
});

describe("react developers in Bangalore", () => {
  const plan = deterministicPlan("React developers in Bangalore");
  it("matches a React Developer", () => {
    const r = rankItem(plan, input({
      extracted: { role: "React Developer", location: "Bangalore", experience: "4 years", skills: ["react"] } as never,
      haystack: "react developer bangalore react redux",
    }));
    expect(r.qualified).toBe(true);
  });

  it("matches a Frontend Engineer with strong React evidence", () => {
    const r = rankItem(plan, input({
      extracted: { role: "Frontend Engineer", location: "Bangalore", experience: "5 years", skills: ["react", "typescript"] } as never,
      haystack: "frontend engineer bangalore react typescript",
    }));
    expect(r.qualified).toBe(true);
  });

  it("rejects a Graphic Designer in Bangalore", () => {
    const r = rankItem(plan, input({
      extracted: { role: "Graphic Designer", location: "Bangalore", experience: "6 years", skills: ["figma"] } as never,
      haystack: "graphic designer bangalore figma",
    }));
    expect(r.qualified).toBe(false);
  });
});

describe("generic designer query", () => {
  const plan = deterministicPlan("designers in Delhi");
  it("allows generic designer roles", () => {
    const r = rankItem(plan, input({
      extracted: { role: "Graphic Designer", location: "Delhi", experience: "5 years", skills: ["figma"] } as never,
      haystack: "graphic designer delhi figma",
    }));
    expect(r.qualified).toBe(true);
  });
  it("still rejects a non-designer", () => {
    const r = rankItem(plan, input({
      extracted: { role: "Accountant", location: "Delhi", experience: "5 years" } as never,
      haystack: "accountant delhi tally",
    }));
    expect(r.qualified).toBe(false);
  });
});

describe("dedupe", () => {
  it("keeps the best hit per candidate and preserves distinct people", () => {
    const rows = [
      { score: 40, extracted: { name: "Itisha Bindal", email: "itisha@x.com" } },
      { score: 72, extracted: { name: "Itisha Bindal", email: "itisha@x.com" }, resume_file_name: "cv.pdf" },
      { score: 55, extracted: { name: "Other Person", email: "other@x.com" } },
    ];
    const out = dedupeHits(rows);
    expect(out).toHaveLength(2);
    expect(out[0]?.score).toBe(72);
  });
});
