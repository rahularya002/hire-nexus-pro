import { describe, expect, it } from "vitest";
import { matchPoolCandidate, type PoolCandidate, type PoolPlan } from "../pool-match";

const plan = (p: Partial<PoolPlan>): PoolPlan => ({
  roles: [],
  skills: [],
  keywords: [],
  locations: [],
  minYears: null,
  maxYears: null,
  ...p,
});

const cand = (c: Partial<PoolCandidate>): PoolCandidate => ({ skills: [], ...c });

// "Fashion designers with 3+ years experience in Delhi or Mumbai"
const fashionPlan = plan({
  roles: ["fashion designer"],
  locations: ["delhi", "new delhi", "ncr", "noida", "gurgaon", "mumbai", "bombay", "thane"],
  minYears: 3,
});

describe("candidate grid: fashion designer query", () => {
  it("matches a Fashion Designer in Mumbai", () => {
    const m = matchPoolCandidate(fashionPlan, cand({ role: "Fashion Designer", experience: "7 years", location: "Mumbai" }));
    expect(m.qualified).toBe(true);
    expect(m.tier).toBe("specific");
    expect(m.score).toBeGreaterThan(60);
  });

  it("matches domain variants (apparel, womenswear)", () => {
    for (const role of ["Apparel Designer", "Womenswear Designer", "Menswear Designer", "Clothing Designer"]) {
      const m = matchPoolCandidate(fashionPlan, cand({ role, experience: "5 years", location: "Delhi" }));
      expect(m.qualified, role).toBe(true);
      expect(m.score, role).toBeGreaterThan(50);
    }
  });

  it("rejects a Graphic Designer with Figma in Mumbai", () => {
    const m = matchPoolCandidate(
      fashionPlan,
      cand({ role: "Graphic Designer", skills: ["Figma", "Illustrator"], experience: "8 years", location: "Mumbai" }),
    );
    expect(m.qualified).toBe(false);
    expect(m.score).toBe(0);
  });

  it("rejects a UX Designer in Delhi", () => {
    const m = matchPoolCandidate(
      fashionPlan,
      cand({ role: "UX Designer", skills: ["Figma", "Wireframing"], experience: "6 years", location: "Delhi" }),
    );
    expect(m.qualified).toBe(false);
  });

  it("rejects unrelated occupations even with strong location / experience", () => {
    for (const c of [
      cand({ role: "Sales Associate", experience: "9 years", location: "Delhi", skills: ["Excel"] }),
      cand({ role: "Software Engineer", experience: "7 years", location: "Mumbai", skills: ["Spring", "Express"] }),
    ]) {
      expect(matchPoolCandidate(fashionPlan, c).qualified).toBe(false);
    }
  });

  it("rejects a candidate with no role, only skills", () => {
    const m = matchPoolCandidate(fashionPlan, cand({ role: null, skills: ["Figma", "wireframing"], location: "Mumbai" }));
    expect(m.qualified).toBe(false);
  });

  it("keeps an adjacent domain (textile designer) but ranks it below an exact match", () => {
    const exact = matchPoolCandidate(fashionPlan, cand({ role: "Fashion Designer", experience: "5 years", location: "Delhi" }));
    const adjacent = matchPoolCandidate(fashionPlan, cand({ role: "Textile Designer", experience: "5 years", location: "Delhi" }));
    expect(adjacent.qualified).toBe(true);
    expect(adjacent.score).toBeLessThan(exact.score);
  });

  it("allows ambiguous Designer only when profile text has strong fashion occupation context", () => {
    const generic = matchPoolCandidate(
      fashionPlan,
      cand({ role: "Designer", notes: "portfolio includes apparel designer work, womenswear and garment collections", experience: "5 years", location: "Delhi" }),
    );
    const weak = matchPoolCandidate(
      fashionPlan,
      cand({ role: "Designer", notes: "figma portfolio and wireframing", experience: "5 years", location: "Delhi" }),
    );
    const exact = matchPoolCandidate(fashionPlan, cand({ role: "Fashion Designer", experience: "5 years", location: "Delhi" }));
    expect(generic.qualified).toBe(true);
    expect(generic.score).toBeLessThan(exact.score);
    expect(weak.qualified).toBe(false);
  });
});

describe("candidate grid: other occupation queries", () => {
  const reactPlan = plan({ roles: ["react developer"], skills: ["react"], locations: ["bengaluru", "bangalore"] });

  it("matches a React Developer and a React-heavy Frontend Engineer", () => {
    expect(
      matchPoolCandidate(reactPlan, cand({ role: "React Developer", skills: ["React"], location: "Bangalore" })).qualified,
    ).toBe(true);
    expect(
      matchPoolCandidate(reactPlan, cand({ role: "Frontend Engineer", skills: ["React", "TypeScript"], location: "Bengaluru" })).qualified,
    ).toBe(true);
  });

  it("rejects a Graphic Designer in Bangalore", () => {
    expect(matchPoolCandidate(reactPlan, cand({ role: "Graphic Designer", location: "Bangalore" })).qualified).toBe(false);
  });

  it("a generic 'designers in Delhi' query accepts generic designer roles", () => {
    const generic = plan({ roles: ["designer"], locations: ["delhi"] });
    expect(matchPoolCandidate(generic, cand({ role: "Graphic Designer", location: "Delhi" })).qualified).toBe(true);
    expect(matchPoolCandidate(generic, cand({ role: "Fashion Designer", location: "Delhi" })).qualified).toBe(true);
    expect(matchPoolCandidate(generic, cand({ role: "Sales Associate", location: "Delhi" })).qualified).toBe(false);
  });

  it("an occupation-free query keeps everyone (plain filtering)", () => {
    const none = plan({ locations: ["pune"] });
    expect(matchPoolCandidate(none, cand({ role: "Sales Associate", location: "Pune" })).qualified).toBe(true);
  });
});
