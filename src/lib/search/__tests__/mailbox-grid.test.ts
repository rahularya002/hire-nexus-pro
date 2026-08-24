import { describe, expect, it } from "vitest";
import {
  candidateKey,
  extractCurrentCtc,
  extractExpectedCtc,
  extractNoticePeriod,
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
