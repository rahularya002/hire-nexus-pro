import { describe, expect, it } from "vitest";
import {
  candidateKey,
  extractCurrentCtc,
  extractExpectedCtc,
  extractNoticePeriod,
  hitsToGridRows,
  candidateGridStatus,
  gridRowsForSearchState,
  matchesGridQuery,
  mergeCandidateRows,
  type GridCandidate,
} from "@/lib/mailbox-grid";

const base = (over: Partial<GridCandidate> & { messageId: string }): GridCandidate => ({
  key: candidateKey({ ...over, messageId: over.messageId }),
  name: null,
  email: null,
  phone: null,
  role: null,
  company: null,
  experience: null,
  location: null,
  skills: [],
  currentCtc: null,
  expectedCtc: null,
  noticePeriod: null,
  confidence: 50,
  unread: false,
  sources: [
    {
      messageId: over.messageId,
      threadId: `t-${over.messageId}`,
      subject: "Resume",
      fromName: "Recruiter",
      fromEmail: "recruiter@agency.com",
      sentAt: "2026-08-01T00:00:00.000Z",
      attachmentNames: [],
      hasResume: false,
    },
  ],
  ...over,
});

describe("compensation extraction", () => {
  it("reads current and expected CTC when stated", () => {
    const t = "Current CTC: 12 LPA\nExpected CTC - 18 lpa\nNotice period: 60 days";
    expect(extractCurrentCtc(t)).toBe("12 LPA");
    expect(extractExpectedCtc(t)).toBe("18 lpa");
    expect(extractNoticePeriod(t)).toBe("60 days");
  });

  it("never invents values", () => {
    const t = "Hi, please find my resume attached. Regards, Gitu";
    expect(extractCurrentCtc(t)).toBeNull();
    expect(extractExpectedCtc(t)).toBeNull();
    expect(extractNoticePeriod(t)).toBeNull();
  });

  it("handles immediate joiners", () => {
    expect(extractNoticePeriod("Notice Period : Immediate")).toMatch(/immediate/i);
    expect(extractNoticePeriod("She is an immediate joiner")).toBe("Immediate");
  });
});

describe("row identity + merging", () => {
  it("merges the same candidate across emails and keeps both sources", () => {
    const rows = mergeCandidateRows([
      base({ messageId: "m1", name: "Gitu Paul", email: "gitu@x.com", role: "Fashion Designer" }),
      base({ messageId: "m2", name: "Gitu Paul", email: "GITU@x.com", confidence: 80, location: "Delhi" }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.sources).toHaveLength(2);
    expect(rows[0]!.location).toBe("Delhi");
    // A blank in the higher-confidence row must not erase a known value.
    expect(rows[0]!.role).toBe("Fashion Designer");
  });

  it("keeps different candidates forwarded by the same recruiter apart", () => {
    const rows = mergeCandidateRows([
      base({ messageId: "m1", name: "Lucy Kom", role: "Designer" }),
      base({ messageId: "m2", name: "Mona Paul", role: "Merchandiser" }),
    ]);
    expect(rows).toHaveLength(2);
  });

  it("keeps unidentifiable rows separate instead of collapsing them", () => {
    const rows = mergeCandidateRows([base({ messageId: "m1" }), base({ messageId: "m2" })]);
    expect(rows).toHaveLength(2);
  });
});

describe("grid query filter", () => {
  it("matches across columns and skills", () => {
    const c = base({ messageId: "m1", name: "Dharna Chhabra", location: "Mumbai", skills: ["Draping"] });
    expect(matchesGridQuery(c, "dharna mumbai")).toBe(true);
    expect(matchesGridQuery(c, "draping")).toBe(true);
    expect(matchesGridQuery(c, "bangalore")).toBe(false);
    expect(matchesGridQuery(c, "")).toBe(true);
  });
});

describe("search hits render as grid rows", () => {
  const hit = (over: Partial<Record<string, unknown>> & { id: string }) =>
    ({
      score: 80,
      confidence: 70,
      subject: "Fashion designer profile",
      snippet: "Current CTC: 12 LPA. Notice period: 30 days",
      from_name: "Recruiter",
      from_email: "recruiter@agency.com",
      sent_at: "2026-08-02T00:00:00.000Z",
      gmail_message_id: `g-${over.id}`,
      gmail_thread_id: `t-${over.id}`,
      resume_file_name: "cv.pdf",
      saved_at: null,
      extracted: {},
      ...over,
    }) as never;

  it("maps a hit to a grid row with score and source, extracting stated fields", () => {
    const [row] = hitsToGridRows([
      hit({ id: "1", extracted: { name: "Gitu Paul", role: "Fashion Designer", email: "gitu@x.com" } }),
    ]);
    expect(row!.name).toBe("Gitu Paul");
    expect(row!.score).toBe(80);
    // Compensation is only trusted from candidate-scoped extraction, never
    // from the Gmail subject/snippet, which often quotes someone else.
    expect(row!.currentCtc).toBeNull();
    expect(row!.noticePeriod).toBeNull();
    expect(row!.sources[0]!.hasResume).toBe(true);
  });

  it("dedupes the same candidate across hits and keeps the best score", () => {
    const rows = hitsToGridRows([
      hit({ id: "1", score: 60, extracted: { name: "Gitu Paul", email: "gitu@x.com" } }),
      hit({ id: "2", score: 90, extracted: { name: "Gitu Paul", email: "GITU@x.com", location: "Mumbai" } }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.score).toBe(90);
    expect(rows[0]!.location).toBe("Mumbai");
    expect(rows[0]!.sources).toHaveLength(2);
  });

  it("keeps distinct candidates forwarded by the same recruiter apart, ranked by score", () => {
    const rows = hitsToGridRows([
      hit({ id: "1", score: 40, extracted: { name: "Lucy Kom", role: "Designer" } }),
      hit({ id: "2", score: 95, extracted: { name: "Mona Paul", role: "Merchandiser" } }),
    ]);
    expect(rows.map((r) => r.name)).toEqual(["Mona Paul", "Lucy Kom"]);
  });
});

describe("grid search status", () => {
  it("labels running search results as progressive instead of final", () => {
    expect(candidateGridStatus({ rowCount: 19, searchActive: true, searching: true })).toBe("19 progressive matching candidates · searching");
  });

  it("uses final wording only after search completes", () => {
    expect(candidateGridStatus({ rowCount: 19, searchActive: true, searching: false })).toBe("19 matching candidates");
  });

  it("labels search failure without presenting zero as final", () => {
    expect(candidateGridStatus({ rowCount: 12, searchActive: true, searching: false, searchFailed: true })).toBe(
      "Search failed · showing existing candidate grid",
    );
  });

  it("keeps the existing grid when a search fails before returning rows", () => {
    const candidates = [base({ messageId: "m1", name: "Existing Candidate" })];
    const rows = gridRowsForSearchState({ candidates, searchRows: [], searchActive: true, searchFailed: true });
    expect(rows).toBe(candidates);
  });
});
