import { describe, expect, it } from "vitest";
import { candidateNameFromText, sanitizeCandidateIdentity, senderLooksLikeCandidate } from "@/lib/candidate-identity";
import { selectResumeForCandidate } from "@/lib/candidate-resume-selection";
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

const KOPAL_CV = `Kopal Sachan
Fashion Designer
kopal.sachan2022@gmail.com
Delhi
4 years experience`;

const RASHMI_CV = `Rashmi Gupta
Womenswear Designer
guptarashmi1111@gmail.com
Mumbai
6 years experience`;

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

  it("does not turn Kopal or Rashmi into recruiter Itisha", () => {
    for (const [docText, email, name] of [
      [KOPAL_CV, "kopal.sachan2022@gmail.com", "Kopal Sachan"],
      [RASHMI_CV, "guptarashmi1111@gmail.com", "Rashmi Gupta"],
    ] as const) {
      const { fields } = extractDeterministic({
        fromEmail: "itisha.bindal@agency.com",
        fromName: "Itisha Bindal",
        cleanBody: "Please find attached profile. Regards, Itisha Bindal",
        docText,
        primaryFileName: `${name.replace(/\s+/g, "_")}_CV.pdf`,
      });
      expect(fields.name).toBe(name);
      expect(fields.email).toBe(email);
      expect(fields.name).not.toBe("Itisha Bindal");
    }
  });

  it("extracts Naushad from CV text even when the forwarding body has no identity", () => {
    const { fields } = extractDeterministic({
      fromEmail: "june.kom@recruiters.in",
      fromName: "June Kom",
      cleanBody: "Attached profile for review.",
      docText: NAUSHAD_CV,
      primaryFileName: "profile.pdf",
    });
    expect(fields.name).toBe("Naushad Belim");
    expect(fields.role).toBe("Apparel Designer");
  });

  it("does not use the body role request as candidate role when a CV is attached", () => {
    const { fields } = extractDeterministic({
      fromEmail: "itisha.bindal@agency.com",
      fromName: "Itisha Bindal",
      cleanBody: "Sharing this profile for Fashion Designer role. Regards, Itisha",
      docText: "Ravi Kumar\nravi@example.com\nMumbai\n5 years experience",
      primaryFileName: "Ravi_Kumar_CV.pdf",
    });
    expect(fields.name).toBe("Ravi Kumar");
    expect(fields.role).toBeNull();
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

  it("same recruiter sending different CVs creates different candidates", () => {
    const rows = mergeCandidateRows([
      row({ messageId: "m-kopal", name: "Kopal Sachan", email: "kopal.sachan2022@gmail.com", role: "Fashion Designer" }),
      row({ messageId: "m-rashmi", name: "Rashmi Gupta", email: "guptarashmi1111@gmail.com", role: "Womenswear Designer" }),
    ]);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.name).sort()).toEqual(["Kopal Sachan", "Rashmi Gupta"]);
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

describe("archive CV evidence selection", () => {
  it("uses the resume matching the stored candidate email when a polluted archive row has multiple CVs", () => {
    const chosen = selectResumeForCandidate(
      [
        { file_name: "Navita Chandwani - Resume.pdf", extracted_text: "Navita Chandwani\nFashion Stylist\nnavita@example.com" },
        { file_name: "Naushad_Khan_Fashion_Designer_Stylist_Resume_2026.pdf", extracted_text: "Naushad Belim\nFashion Designer\nnaushadbelim50@gmail.com\nMumbai" },
      ],
      { name: "Name not found", email: "naushadbelim50@gmail.com", phone: null },
    );

    expect(chosen?.file_name).toBe("Naushad_Khan_Fashion_Designer_Stylist_Resume_2026.pdf");
  });

  it("uses filename/email evidence when old stored name points at the wrong CV and extracted text is empty", () => {
    const chosen = selectResumeForCandidate(
      [
        { file_name: "Navita Chandwani - Resume.pdf", extracted_text: "" },
        { file_name: "Naushad_Khan_Fashion_Designer_Stylist_Resume_2026.pdf", extracted_text: "" },
      ],
      { name: "Navita Chandwani", email: "naushadbelim50@gmail.com", phone: null },
    );

    expect(chosen?.file_name).toBe("Naushad_Khan_Fashion_Designer_Stylist_Resume_2026.pdf");
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
    expect(run({ role: "Makeup Artist", location: "Delhi", experience: "5 years" }, "makeup artist delhi styling").qualified).toBe(false);
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
