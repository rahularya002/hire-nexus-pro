import { describe, expect, it } from "vitest";
import { candidateNameFromText, sanitizeCandidateIdentity, senderLooksLikeCandidate } from "@/lib/candidate-identity";
import { extractDeterministic } from "@/lib/pipeline/normalize.server";
import { candidateKey, mergeCandidateRows, type GridCandidate } from "@/lib/mailbox-grid";
import { deterministicPlan } from "../query-plan.server";
import { rankItem, type RankInput } from "../rank.server";

const PREM_CV = `Prem Lata Chauhan
Fashion Designer
Email: prem.lata@gmail.com
Phone: +91 98111 22334
Delhi, India
7 years of experience in womenswear design`;

const NAUSHAD_CV = `Naushad Belim
Apparel Designer
naushad.belim@outlook.com
Mobile: 9822011223
Mumbai
5 years experience`;

describe("candidate identity comes from the resume, never the Gmail sender", () => {
  it("uses the CV name when Itisha Bindal forwards Prem Lata Chauhan's resume", () => {
    const { fields } = extractDeterministic({
      fromEmail: "itisha.bindal@agency.com",
      fromName: "Itisha Bindal",
      cleanBody: "Hi, sharing a profile for your fashion designer role. Regards, Itisha",
      docText: PREM_CV,
      primaryFileName: "Prem_Lata_Resume.pdf",
    });
    expect(fields.name).toBe("Prem Lata Chauhan");
    expect(fields.email).toBe("prem.lata@gmail.com");
    expect(fields.name).not.toMatch(/itisha/i);
  });

  it("uses the CV name when June Kom forwards Naushad Belim's resume", () => {
    const { fields } = extractDeterministic({
      fromEmail: "june.kom@recruiters.in",
      fromName: "June Kom",
      cleanBody: "Please find attached CV. Thanks, June",
      docText: NAUSHAD_CV,
      primaryFileName: "naushad-cv.pdf",
    });
    expect(fields.name).toBe("Naushad Belim");
    expect(fields.email).toBe("naushad.belim@outlook.com");
  });

  it("reads a labelled candidate name out of a recruiter's submission mail", () => {
    expect(candidateNameFromText("Candidate Name: Prem Lata Chauhan\nRole: Designer")).toBe("Prem Lata Chauhan");
    const { fields } = extractDeterministic({
      fromEmail: "itisha.bindal@agency.com",
      fromName: "Itisha Bindal",
      cleanBody: "Candidate Name: Naushad Belim\nCurrent CTC: 8 LPA",
      docText: "",
      primaryFileName: null,
    });
    expect(fields.name).toBe("Naushad Belim");
  });

  it("does not fall back to the Gmail sender name when identity is missing", () => {
    const { fields } = extractDeterministic({
      fromEmail: "itisha.bindal@agency.com",
      fromName: "Itisha Bindal",
      cleanBody: "Sharing a few profiles for the open role, details to follow.",
      docText: "Confidential profile summary. Strong portfolio. Available immediately.",
      primaryFileName: "profile.pdf",
    });
    expect(fields.name).toBeNull();
    expect(fields.email).toBeNull();
  });

  it("still trusts a genuine self-application", () => {
    const { fields } = extractDeterministic({
      fromEmail: "prem.lata@gmail.com",
      fromName: "Prem Lata Chauhan",
      cleanBody: "Hello, applying for the fashion designer role. prem.lata@gmail.com",
      docText: "",
      primaryFileName: null,
    });
    expect(senderLooksLikeCandidate({
      fromEmail: "prem.lata@gmail.com",
      fromName: "Prem Lata Chauhan",
      bodyText: "reach me at prem.lata@gmail.com",
    })).toBe(true);
    expect(fields.name).toBe("Prem Lata Chauhan");
    expect(fields.email).toBe("prem.lata@gmail.com");
  });

  it("drops a recruiter signature phone that the CV never states", () => {
    const clean = sanitizeCandidateIdentity(
      { name: "Prem Lata Chauhan", email: "prem.lata@gmail.com", phone: "+91 90000 11111" },
      {
        fromEmail: "itisha.bindal@agency.com",
        fromName: "Itisha Bindal",
        docText: PREM_CV,
        bodyText: "Regards, Itisha Bindal | +91 90000 11111",
        hasAttachment: true,
      },
    );
    expect(clean.phone).toBeNull();
    expect(clean.name).toBe("Prem Lata Chauhan");
  });
});

const row = (over: Partial<GridCandidate> & { messageId: string }): GridCandidate => ({
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
  confidence: 60,
  unread: false,
  sources: [
    {
      messageId: over.messageId,
      threadId: `t-${over.messageId}`,
      subject: "Profile",
      fromName: "Itisha Bindal",
      fromEmail: "itisha.bindal@agency.com",
      sentAt: "2026-08-10T00:00:00.000Z",
      attachmentNames: ["cv.pdf"],
      hasResume: true,
    },
  ],
  ...over,
});

describe("dedupe uses candidate identity, not the recruiter", () => {
  it("keeps ten resumes from one recruiter as ten candidates", () => {
    const rows = mergeCandidateRows(
      Array.from({ length: 10 }, (_, i) =>
        row({ messageId: `m${i}`, name: `Candidate ${i}`, email: `c${i}@mail.com` }),
      ),
    );
    expect(rows).toHaveLength(10);
  });

  it("merges one candidate seen in several emails into a single row with all sources", () => {
    const rows = mergeCandidateRows([
      row({ messageId: "m1", name: "Prem Lata Chauhan", email: "prem.lata@gmail.com" }),
      row({ messageId: "m2", name: "Prem Lata Chauhan", email: "PREM.LATA@gmail.com", location: "Delhi" }),
      row({ messageId: "m3", name: "Prem Lata", phone: "+91 98111 22334" }),
    ]);
    expect(rows).toHaveLength(2); // email-identified row merged; phone-only row stays distinct
    expect(rows[0]!.sources).toHaveLength(2);
    expect(rows[0]!.location).toBe("Delhi");
  });
});

describe("role relevance outweighs generic skill overlap", () => {
  const plan = deterministicPlan("Fashion designers with 3+ years experience in Delhi or Mumbai");
  const run = (extracted: Record<string, unknown>, haystack: string) =>
    rankItem(plan, {
      extracted: extracted as never,
      confidence: 90,
      hasResume: true,
      sentAt: new Date().toISOString(),
      haystack,
    } satisfies RankInput);

  it("rejects UI/UX and graphic designers with Figma / wireframing evidence", () => {
    for (const role of ["Graphic Designer", "UI/UX Designer", "Product Designer", "Visual Designer", "Web Designer"]) {
      const r = run(
        { role, location: "Mumbai", experience: "8 years", skills: ["figma", "wireframing", "ux"] },
        `${role.toLowerCase()} mumbai figma wireframing ux 8 years`,
      );
      expect(r.qualified, role).toBe(false);
    }
  });

  it("rejects unrelated occupations even with matching city and years", () => {
    expect(run({ role: "Sales Associate", location: "Delhi", experience: "9 years" }, "sales associate delhi excel").qualified).toBe(false);
    expect(
      run({ role: "Software Engineer", location: "Mumbai", experience: "7 years", skills: ["spring", "express"] }, "software engineer mumbai spring express").qualified,
    ).toBe(false);
  });

  it("does not infer the occupation from skills when the role is unknown", () => {
    const r = run({ location: "Delhi", experience: "6 years", skills: ["figma", "wireframing"] }, "figma wireframing delhi");
    expect(r.qualified).toBe(false);
  });

  it("ranks a real fashion designer above a graphic designer with more skill overlap", () => {
    const fashion = run({ role: "Fashion Designer", location: "Delhi", experience: "4 years" }, "fashion designer delhi");
    const graphic = run(
      { role: "Graphic Designer", location: "Delhi", experience: "8 years", skills: ["figma", "illustrator", "photoshop"] },
      "graphic designer delhi figma illustrator photoshop",
    );
    expect(fashion.score).toBeGreaterThan(graphic.score);
  });
});
