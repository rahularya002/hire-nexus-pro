import { describe, expect, it } from "vitest";
import { extractScopedFields } from "@/lib/candidate-fields";

const CV = `PRIYA SHARMA
Fashion Designer
priya.sharma@example.com | +91 98111 22334
Current Location: Delhi
Total Experience: 4 years
Current Company: Aurelia Apparel
Current CTC: 8.5 LPA
Expected CTC: 12 LPA
Notice Period: 30 days
`;

// A recruiter tracker: several people in one mail. Nothing here belongs to the
// candidate whose CV is attached.
const TRACKER_BODY = `Hi team, please find profiles below.
Name: Rahul Verma | Location: Mumbai | Experience: 9 years | CTC: 25 LPA | Notice Period: 90 days
Name: Sneha Rao | Location: Pune | Experience: 7 years | CTC: 19 LPA | Notice Period: 60 days
Regards, Itisha Bindal`;

describe("scoped candidate field extraction", () => {
  it("reads role, experience, location, company, CTC and notice from the CV", () => {
    const f = extractScopedFields({ docText: CV, bodyText: "", bodyTrusted: false });
    expect(f.role.value).toBe("Fashion Designer");
    expect(f.experience.value).toBe("4 years");
    expect(f.location.value).toBe("Delhi");
    expect(f.company.value).toMatch(/Aurelia/i);
    expect(f.currentCtc.value).toMatch(/8\.5/);
    expect(f.expectedCtc.value).toMatch(/12/);
    expect(f.noticePeriod.value).toMatch(/30 days/i);
    expect(f.role.provenance).toBe("cv_header");
  });

  it("never inherits another person's city / years / package from a tracker mail", () => {
    const f = extractScopedFields({ docText: CV, bodyText: TRACKER_BODY, bodyTrusted: false });
    expect(f.location.value).toBe("Delhi");
    expect(f.experience.value).toBe("4 years");
    expect(f.currentCtc.value).not.toMatch(/25/);
    expect(f.noticePeriod.value).not.toMatch(/90/);
  });

  it("returns nulls rather than guesses when the CV is scanned and the body is untrusted", () => {
    const f = extractScopedFields({ docText: "", bodyText: TRACKER_BODY, bodyTrusted: false });
    expect(f.role.value).toBeNull();
    expect(f.location.value).toBeNull();
    expect(f.experience.value).toBeNull();
    expect(f.currentCtc.value).toBeNull();
    expect(f.noticePeriod.value).toBeNull();
  });

  it("uses a trusted single-candidate body when there is no resume text", () => {
    const body = `Dear HR, I am applying for the role of Fashion Designer.
Current Location: Mumbai
Total Experience: 3 years
Current CTC: 6 LPA
Expected CTC: 9 LPA
Notice Period: Immediate`;
    const f = extractScopedFields({ docText: "", bodyText: body, bodyTrusted: true });
    expect(f.role.value).toBe("Fashion Designer");
    expect(f.location.value).toBe("Mumbai");
    expect(f.experience.value).toBe("3 years");
    expect(f.currentCtc.value).toMatch(/6/);
    expect(f.noticePeriod.value).toMatch(/immediate/i);
    expect(f.location.provenance).toBe("email_body");
  });

  it("rejects meaningless numeric CTC and out-of-range experience", () => {
    const f = extractScopedFields({
      docText: "Experience: 90 years\nCTC: 4520193\nNotice: sometime soon",
      bodyText: "",
      bodyTrusted: false,
    });
    expect(f.experience.value).toBeNull();
    expect(f.currentCtc.value).toBeNull();
    expect(f.noticePeriod.value).toBeNull();
  });
});

describe("experience false positives", () => {
  it("does not read employment dates as years of experience", () => {
    const f = extractScopedFields({
      docText: "Ravi Kumar\nravi@example.com\n\nWORK EXPERIENCE\n2019 - 2023 Designer, Acme Ltd\n",
      bodyText: "",
      bodyTrusted: false,
    });
    expect(f.experience.value).toBeNull();
  });

  it("still reads an explicit labelled duration", () => {
    const f = extractScopedFields({
      docText: "Experience: 6 yrs\n",
      bodyText: "",
      bodyTrusted: false,
    });
    expect(f.experience.value).toBe("6 years");
  });
});
