// END-TO-END verification of the production Candidate Grid search path for the
// exact recruiter query used in production. These tests deliberately avoid
// testing helpers in isolation: they compose the SAME functions, in the SAME
// order, as `startCandidateSearch` (src/lib/search/search.functions.ts) and the
// grid adapter, so a bypass in the production path fails here too.
import { describe, expect, it } from "vitest";
import { deterministicPlan } from "@/lib/search/query-plan.server";
import { rankItem } from "@/lib/search/rank.server";
import { occupationRequirement } from "@/lib/search/occupation";
import { extractDeterministic } from "@/lib/pipeline/normalize.server";
import { sanitizeCandidateIdentity } from "@/lib/candidate-identity";
import { pickPrimaryCandidateAttachment } from "@/lib/candidate-attachment";
import { hitsToGridRows, candidateGridStatus } from "@/lib/mailbox-grid";

const QUERY = "Fashion designers with 3+ years experience in Delhi or Mumbai";

/** The real plan the production code builds for this query. */
const plan = deterministicPlan(QUERY);

type Person = {
  label: string;
  role: string | null;
  experience: string | null;
  location: string | null;
  skills: string[];
  /** Resume + email text, exactly what the archive path passes as `haystack`. */
  text: string;
};

/** Mirrors the archive branch: rankItem over extracted fields + haystack. */
function evaluate(p: Person) {
  return rankItem(plan, {
    extracted: {
      name: p.label,
      email: null,
      phone: null,
      role: p.role,
      current_company: null,
      experience: p.experience,
      location: p.location,
      salary_min: null,
      salary_max: null,
      skills: p.skills,
      notes: null,
    },
    confidence: 90,
    hasResume: true,
    sentAt: new Date().toISOString(),
    haystack: `${p.role ?? ""} ${p.location ?? ""} ${p.experience ?? ""} ${p.skills.join(" ")} ${p.text}`,
  });
}

describe("A) occupation relevance for the production fashion query", () => {
  it("parses 'fashion designer' as one atomic, specific occupation", () => {
    expect(plan.roles).toContain("fashion designer");
    expect(plan.minYears).toBe(3);
    expect(plan.locations.sort()).toEqual(["delhi", "mumbai"]);
    const req = occupationRequirement(plan.roles);
    expect(req.specificity).toBe("specific");
    expect(req.specs[0]!.phrase).toBe("fashion designer");
  });

  const pass: Person[] = [
    {
      label: "Fashion Designer, 7 years, Mumbai",
      role: "Fashion Designer",
      experience: "7 years",
      location: "Mumbai",
      skills: ["Draping", "Pattern Making"],
      text: "Fashion designer with womenswear collections for retail brands.",
    },
    {
      label: "Apparel Designer, 5 years, Delhi",
      role: "Apparel Designer",
      experience: "5 years",
      location: "Delhi",
      skills: ["Sketching", "Tech Packs"],
      text: "Apparel design for garment export house.",
    },
    {
      label: "Womenswear Designer, 6 years, Mumbai",
      role: "Womenswear Designer",
      experience: "6 years",
      location: "Mumbai",
      skills: ["Draping"],
      text: "Womenswear designer, ethnic and bridal ranges.",
    },
    {
      label: "Menswear Designer, 4 years, Delhi",
      role: "Menswear Designer",
      experience: "4 years",
      location: "New Delhi",
      skills: ["Illustrator"],
      text: "Menswear designer for a clothing label.",
    },
  ];

  it.each(pass)("qualifies $label", (p) => {
    const r = evaluate(p);
    expect(r.qualified).toBe(true);
    expect(r.score).toBeGreaterThan(0);
  });

  const fail: Person[] = [
    {
      label: "UI/UX Designer, 6 years, Mumbai",
      role: "UI/UX Designer",
      experience: "6 years",
      location: "Mumbai",
      skills: ["Figma", "Wireframing"],
      text: "UI UX designer, wireframing, prototyping, design systems in Figma.",
    },
    {
      label: "Graphic Designer, 8 years, Mumbai",
      role: "Graphic Designer",
      experience: "8 years",
      location: "Mumbai",
      skills: ["Figma", "Photoshop"],
      text: "Graphic designer, brand collateral, packaging, Figma.",
    },
    {
      label: "Product Designer, 7 years, Delhi",
      role: "Product Designer",
      experience: "7 years",
      location: "Delhi",
      skills: ["Figma"],
      text: "Product designer working on SaaS dashboards.",
    },
    {
      label: "Sales Associate, 9 years, Delhi",
      role: "Sales Associate",
      experience: "9 years",
      location: "Delhi",
      skills: ["Excel", "CRM"],
      text: "Retail sales associate, target achievement, Excel reporting.",
    },
    {
      label: "Makeup Artist, 6 years, Mumbai",
      role: "Makeup Artist",
      experience: "6 years",
      location: "Mumbai",
      skills: ["Bridal Makeup"],
      text: "Freelance makeup artist for shoots and weddings.",
    },
    {
      label: "Software Engineer, 7 years, Mumbai",
      role: "Software Engineer",
      experience: "7 years",
      location: "Mumbai",
      skills: ["Spring", "Express", "Java"],
      text: "Backend engineer, Spring Boot, Express, microservices.",
    },
    {
      label: "Generic Designer with only Figma and no fashion context",
      role: "Designer",
      experience: "5 years",
      location: "Mumbai",
      skills: ["Figma", "Wireframing"],
      text: "Designer. Figma, wireframing, prototyping. Worked with product teams.",
    },
    {
      label: "Unknown role with only generic skills",
      role: null,
      experience: "4 years",
      location: "Delhi",
      skills: ["Excel", "Communication"],
      text: "Please find attached my resume. Excel, communication, teamwork.",
    },
  ];

  it.each(fail)("does NOT qualify $label", (p) => {
    const r = evaluate(p);
    // Final qualification/filtering behaviour, not merely a lower rank.
    expect(r.qualified).toBe(false);
    expect(r.score).toBe(0);
  });

  it("skills, location and years never substitute for the occupation", () => {
    // Perfect on every refiner, wrong occupation → still excluded.
    const r = evaluate({
      label: "UI/UX in Mumbai with 3 yrs",
      role: "UI/UX Designer",
      experience: "3 years",
      location: "Mumbai",
      skills: ["Figma", "Draping"],
      text: "Mumbai. 3 years. Figma, wireframing.",
    });
    expect(r.qualified).toBe(false);
  });

  it("the archive branch drops unqualified people instead of storing them", () => {
    // Mirrors `if (!ranked.qualified) return []` in startCandidateSearch.
    const stored = fail.map(evaluate).filter((r) => r.qualified);
    expect(stored).toHaveLength(0);
  });
});

describe("B) candidate identity on forwarded resumes", () => {
  const forward = (args: {
    fromName: string;
    fromEmail: string;
    docText: string;
    body?: string;
    file?: string | null;
    storedName?: string | null;
    storedEmail?: string | null;
    storedPhone?: string | null;
  }) => {
    // Composition copied from the archive branch of startCandidateSearch.
    const det = extractDeterministic({
      fromEmail: args.fromEmail,
      fromName: args.fromName,
      cleanBody: args.body ?? "",
      docText: args.docText,
      primaryFileName: args.file ?? "resume.pdf",
    }).fields;
    const safeStored = sanitizeCandidateIdentity(
      { name: args.storedName ?? null, email: args.storedEmail ?? null, phone: args.storedPhone ?? null },
      {
        fromEmail: args.fromEmail,
        fromName: args.fromName,
        bodyText: args.body ?? "",
        docText: args.docText,
        hasAttachment: true,
      },
    );
    return {
      name: det.name ?? safeStored.name ?? null,
      email: det.email ?? safeStored.email ?? null,
      phone: det.phone ?? safeStored.phone ?? null,
    };
  };

  it("uses the CV candidate, not the forwarding recruiter (Itisha Bindal → Prem Lata Chauhan)", () => {
    const row = forward({
      fromName: "Itisha Bindal",
      fromEmail: "itisha.bindal@agency.com",
      docText:
        "Candidate Name: Prem Lata Chauhan\nEmail: prem.chauhan@gmail.com\nPhone: 9876543210\nFashion Designer with 5 years experience in Delhi.",
      body: "Hi, sharing a profile for your fashion designer role. Regards, Itisha Bindal | Itisha.bindal@agency.com",
      storedName: "Itisha Bindal",
      storedEmail: "itisha.bindal@agency.com",
    });
    expect(row.name).toBe("Prem Lata Chauhan");
    expect(row.email).toBe("prem.chauhan@gmail.com");
    expect(row.email).not.toBe("itisha.bindal@agency.com");
  });

  it("uses the CV candidate for a second recruiter (June Kom → Naushad Belim)", () => {
    const row = forward({
      fromName: "June Kom",
      fromEmail: "june.kom@agency.com",
      docText:
        "Candidate Name: Naushad Belim\nEmail: naushadbelim50@gmail.com\nPhone: 9812345670\nApparel Designer, Mumbai, 6 years.",
      storedName: "June kom",
      storedEmail: "june.kom@agency.com",
    });
    expect(row.name).toBe("Naushad Belim");
    expect(row.email).toBe("naushadbelim50@gmail.com");
  });

  it("keeps two CVs from the SAME recruiter as two different people", () => {
    const a = forward({
      fromName: "Itisha Bindal",
      fromEmail: "itisha.bindal@agency.com",
      docText: "Candidate Name: Prem Lata Chauhan\nEmail: prem.chauhan@gmail.com\nFashion Designer.",
    });
    const b = forward({
      fromName: "Itisha Bindal",
      fromEmail: "itisha.bindal@agency.com",
      docText: "Candidate Name: Naushad Belim\nEmail: naushadbelim50@gmail.com\nApparel Designer.",
    });
    expect(a.name).not.toBe(b.name);
    expect([a.name, b.name]).toEqual(["Prem Lata Chauhan", "Naushad Belim"]);
  });

  it("never falls back to the sender name when the CV has no candidate name", () => {
    const row = forward({
      fromName: "Itisha Bindal",
      fromEmail: "itisha.bindal@agency.com",
      docText: "Fashion designer profile. 5 years in womenswear. Delhi based.",
      body: "Sharing a profile. Regards, Itisha Bindal",
      file: "profile.pdf",
      storedName: "Itisha Bindal",
    });
    expect(row.name).toBeNull();
  });

  it("never falls back to the sender email or signature phone", () => {
    const row = forward({
      fromName: "Itisha Bindal",
      fromEmail: "itisha.bindal@agency.com",
      docText: "Fashion designer, womenswear, Delhi.",
      body: "Regards, Itisha Bindal | itisha.bindal@agency.com | +91 99999 88888",
      storedEmail: "itisha.bindal@agency.com",
      storedPhone: "+91 99999 88888",
    });
    expect(row.email).toBeNull();
    expect(row.phone).toBeNull();
  });
});

describe("C) grid adapter never uses Gmail sender data as identity", () => {
  const hit = (over: Record<string, unknown>) =>
    ({
      id: "h1",
      score: 82,
      confidence: 90,
      subject: "Fashion designer profile",
      snippet: "Fashion designer, 5 years, Mumbai",
      from_name: "Itisha Bindal",
      from_email: "itisha.bindal@agency.com",
      sent_at: "2026-08-20T00:00:00.000Z",
      gmail_message_id: "g1",
      gmail_thread_id: "t1",
      resume_file_name: "cv.pdf",
      extracted: {},
      ...over,
    }) as never;

  it("shows the extracted candidate, with the sender kept as provenance only", () => {
    const [row] = hitsToGridRows([
      hit({ extracted: { name: "Prem Lata Chauhan", email: "prem.chauhan@gmail.com", role: "Fashion Designer" } }),
    ]);
    expect(row!.name).toBe("Prem Lata Chauhan");
    expect(row!.email).toBe("prem.chauhan@gmail.com");
    expect(row!.sources[0]!.fromName).toBe("Itisha Bindal");
  });

  it("leaves the name blank rather than showing the recruiter when identity is unknown", () => {
    const [row] = hitsToGridRows([hit({ extracted: {} })]);
    expect(row!.name).toBeNull();
    expect(row!.email).toBeNull();
  });

  it("does not collapse different candidates sent by one recruiter into repeated rows", () => {
    const rows = hitsToGridRows([
      hit({ id: "h1", gmail_message_id: "g1", extracted: { name: "Prem Lata Chauhan", email: "prem@x.com" } }),
      hit({ id: "h2", gmail_message_id: "g2", extracted: { name: "Naushad Belim", email: "naushadbelim50@gmail.com" } }),
      hit({ id: "h3", gmail_message_id: "g3", extracted: { name: "Naushad Belim", email: "NAUSHADBELIM50@gmail.com" } }),
    ]);
    expect(rows.map((r) => r.name).sort()).toEqual(["Naushad Belim", "Prem Lata Chauhan"]);
    expect(new Set(rows.map((r) => r.name)).size).toBe(rows.length);
  });

  it("selects a CV attachment, not a JD or signature image, before extraction", () => {
    const primary = pickPrimaryCandidateAttachment([
      { fileName: "logo.png", mimeType: "image/png", externalId: "a1", size: 4000 },
      { fileName: "Prem Lata Chauhan Resume.pdf", mimeType: "application/pdf", externalId: "a2", size: 120000 },
    ] as never);
    expect((primary as { fileName: string } | null)?.fileName).toBe("Prem Lata Chauhan Resume.pdf");
  });
});

describe("D/E) screenshot regressions cannot be reproduced, recall is preserved", () => {
  it("the screenshot's unrelated roles are all excluded for this query", () => {
    const screenshot: Person[] = [
      { label: "sales", role: "Sales Executive", experience: "9 years", location: "Delhi", skills: ["Excel"], text: "sales" },
      { label: "makeup", role: "Makeup Artist", experience: "6 years", location: "Mumbai", skills: [], text: "makeup" },
      { label: "swe", role: "Software Engineer", experience: "7 years", location: "Mumbai", skills: ["Spring", "Express"], text: "java" },
      { label: "uiux", role: "UI Designer", experience: "5 years", location: "Mumbai", skills: ["Figma"], text: "wireframing" },
    ];
    expect(screenshot.filter((p) => evaluate(p).qualified)).toEqual([]);
  });

  it("still returns real fashion candidates — precision did not cost recall", () => {
    const pool: Person[] = [
      { label: "fd", role: "Fashion Designer", experience: "7 years", location: "Mumbai", skills: ["Draping"], text: "womenswear" },
      { label: "ad", role: "Apparel Designer", experience: "5 years", location: "Delhi", skills: [], text: "garment" },
      { label: "uiux", role: "UI/UX Designer", experience: "6 years", location: "Mumbai", skills: ["Figma"], text: "wireframing" },
    ];
    const qualified = pool.filter((p) => evaluate(p).qualified).map((p) => p.label);
    expect(qualified).toEqual(["fd", "ad"]);
  });

  it("recovers a fashion candidate whose title extraction failed but whose CV proves the occupation", () => {
    const r = evaluate({
      label: "title missing",
      role: null,
      experience: "5 years",
      location: "Delhi",
      skills: ["Draping"],
      text: "Worked as a fashion designer for a womenswear label in Delhi for five years.",
    });
    expect(r.qualified).toBe(true);
  });
});

describe("F) search state never presents in-progress results as final", () => {
  it("marks a running search as progressive", () => {
    expect(candidateGridStatus({ rowCount: 7, searchActive: true, searching: true })).toMatch(/progressive/);
    expect(candidateGridStatus({ rowCount: 7, searchActive: true, searching: true })).toMatch(/searching/);
  });

  it("uses final wording only once the search finished", () => {
    expect(candidateGridStatus({ rowCount: 7, searchActive: true, searching: false })).toBe("7 matching candidates");
  });

  it("does not present zero as a final answer when the search failed", () => {
    expect(candidateGridStatus({ rowCount: 0, searchActive: true, searching: false, searchFailed: true })).toMatch(/failed/i);
  });
});
