import { describe, expect, it } from "vitest";
import { extractCvName, nameFromFileName, personNameFrom } from "../../cv-name";
import { extractDeterministic } from "../../pipeline/normalize.server";

const RECRUITER = { fromEmail: "itisha@recruitfirm.com", fromName: "Itisha Bindal" };

const det = (docText: string, primaryFileName: string | null = "resume.pdf", cleanBody = "") =>
  extractDeterministic({ ...RECRUITER, cleanBody, docText, primaryFileName }).fields;

describe("extractCvName — realistic CV layouts", () => {
  it("reads an ALL CAPS header line", () => {
    expect(extractCvName("PREM LATA CHAUHAN\n+91 9876543210\nprem@gmail.com")).toBe("Prem Lata Chauhan");
  });

  it("reads a Title Case header line", () => {
    expect(extractCvName("Naushad Belim\nnaushadbelim50@gmail.com\n+91 9812345678")).toBe("Naushad Belim");
  });

  it("reads a header with inline contact details", () => {
    expect(extractCvName("PREM LATA CHAUHAN | +91 9876543210 | prem.lata@gmail.com | Mumbai")).toBe(
      "Prem Lata Chauhan",
    );
  });

  it("reads a labelled name", () => {
    expect(extractCvName("Curriculum Vitae\nName: Prem Lata Chauhan\nMumbai")).toBe("Prem Lata Chauhan");
  });

  it("reads name above role and location", () => {
    expect(extractCvName("Prem Lata Chauhan\nFashion Designer\nMumbai\nprem@x.com")).toBe("Prem Lata Chauhan");
  });

  it("survives broken PDF whitespace", () => {
    expect(extractCvName("\n\n   PREM   LATA   CHAUHAN   \n\n  Mumbai , India   \n +91 98765 43210")).toBe(
      "Prem Lata Chauhan",
    );
  });

  it("survives glyph-spaced PDF text", () => {
    expect(extractCvName("P R E M  L A T A  C H A U H A N\nMumbai")).toBe("Prem Lata Chauhan");
  });

  it("accepts mixed case", () => {
    expect(extractCvName("Prem Lata CHAUHAN\nMumbai")).toBe("Prem Lata Chauhan");
  });

  it("accepts a middle initial", () => {
    expect(extractCvName("Prem L. Chauhan\nMumbai")).toBe("Prem L. Chauhan");
  });

  it("finds a name pushed past the cover page", () => {
    const doc = ["CONFIDENTIAL", "RESUME", "Objective", "a", "b", "c", "d", "e", "f", "g", "h", "i", "Prem Lata Chauhan", "Mumbai"].join("\n");
    expect(extractCvName(doc)).toBe("Prem Lata Chauhan");
  });

  it("prefers the name over a role header line", () => {
    expect(extractCvName("FASHION DESIGNER\nPREM LATA CHAUHAN\nMumbai")).toBe("Prem Lata Chauhan");
  });

  it("splits a two-column header", () => {
    expect(extractCvName("PREM LATA CHAUHAN                     FASHION DESIGNER")).toBe("Prem Lata Chauhan");
    expect(extractCvName("PREM LATA CHAUHAN\t\tMumbai, India\nprem@x.com")).toBe("Prem Lata Chauhan");
  });

  it("falls back to the CV filename when the text has no name", () => {
    expect(extractCvName("Objective: seeking a role\nSkills: figma", "Prem Lata Chauhan Resume.pdf")).toBe(
      "Prem Lata Chauhan",
    );
  });

  it("returns null when no name exists anywhere", () => {
    expect(extractCvName("Objective: seeking role\nSkills: figma", "resume-final.pdf")).toBeNull();
  });

  it("rejects headings, roles and places as names", () => {
    expect(personNameFrom("CURRICULUM VITAE")).toBeNull();
    expect(personNameFrom("Fashion Designer")).toBeNull();
    expect(personNameFrom("New Delhi")).toBeNull();
    expect(personNameFrom("Contact Details")).toBeNull();
    expect(personNameFrom("prem@x.com")).toBeNull();
  });

  it("ignores role words and stopwords in filenames", () => {
    expect(nameFromFileName("Naushad Belim CV updated.pdf")).toBe("Naushad Belim");
    expect(nameFromFileName("Job Description - Manager.pdf")).toBeNull();
  });
});

describe("deterministic extraction keeps the CV identity, never the sender", () => {
  it("uses the CV name for a forwarded resume", () => {
    const fields = det("PREM LATA CHAUHAN\n+91 9876543210\nprem.lata@gmail.com\nFashion Designer, Mumbai");
    expect(fields.name).toBe("Prem Lata Chauhan");
    expect(fields.email).toBe("prem.lata@gmail.com");
  });

  it("uses the CV name for a second forward from the same recruiter", () => {
    const fields = det("Naushad Belim\nnaushadbelim50@gmail.com\n+91 9812345678\nApparel Designer");
    expect(fields.name).toBe("Naushad Belim");
    expect(fields.email).toBe("naushadbelim50@gmail.com");
  });

  it("never falls back to the recruiter name, email or phone", () => {
    const fields = det(
      "Objective: seeking a fashion design role\nSkills: draping, illustration",
      "resume-final.pdf",
      "Hi team, sharing a profile.\nRegards, Itisha Bindal\nitisha@recruitfirm.com\n+91 90000 11111",
    );
    expect(fields.name).toBeNull();
    expect(fields.email).toBeNull();
    expect(fields.phone).toBeNull();
  });
});

// Layouts observed in REAL mailbox resumes (Sept 2026 end-to-end run).
describe("real-mail CV layouts", () => {
  it("takes a trailing initial as part of the name", () => {
    expect(extractCvName("Kavya A\n9535917010\nProfessional summary", "Kavya CV.pdf")).toBe("Kavya A");
  });

  it("stitches a name split across columned lines", () => {
    const text = "D\nHARSHITHA\nREDDY\nAbout Me\nAspiring fashion consultant";
    expect(extractCvName(text, "Harshitha cV.pdf")).toBe("D Harshitha Reddy");
  });

  it("never takes a section heading or institution as the name", () => {
    expect(extractCvName("About Me\nBMS Womens College\nCustomer satisfaction focus", null)).toBeNull();
  });

  it("ignores prose pairs inside a single-blob PDF extraction", () => {
    const blob =
      "Kavya A Experience Professional summary Resolving issues in a timely manner " +
      "Collaborated with team members to improve overall customer experience ".repeat(6);
    expect(extractCvName(blob, "Kavya CV.pdf")).toBe("Kavya A");
  });

  it("uses a single-word CV filename when the PDF has no text layer", () => {
    expect(extractCvName("", "Roshni CV.pdf")).toBe("Roshni");
    expect(extractCvName("", "Document 72.pdf")).toBeNull();
  });
});

describe("scanned CV contact safety", () => {
  it("does not borrow contact details from the recruiter's mail body", () => {
    const fields = det("", "Roshni CV.pdf", "Tracker:\nSumen Sarkar - sarkar.s@gmail.com - 9876543948");
    expect(fields.name).toBe("Roshni");
    expect(fields.email).toBeNull();
    expect(fields.phone).toBeNull();
  });
});

describe("isPlausibleCandidateName single-word names", () => {
  it("keeps a single distinctive stored name", () => {
    expect(isPlausibleCandidateName("Roshni")).toBe(true);
  });
  it("still rejects noise and headings", () => {
    expect(isPlausibleCandidateName("Resume")).toBe(false);
    expect(isPlausibleCandidateName("Gmail")).toBe(false);
    expect(isPlausibleCandidateName("Designer")).toBe(false);
  });
});
