import { describe, expect, it } from "vitest";
import { evidenceChips, sourceLabel, sourceState, type EvidenceHit } from "../evidence";

const base: EvidenceHit = {
  gmail_message_id: "m1",
  extracted: { role: "Fashion Designer", experience: "7 years", location: "Mumbai", skills: ["draping"] },
  score_parts: { matched: ["fashion designer", "resume attached", "mumbai"], missing: [] },
};

describe("search hit source states", () => {
  it("email available → Open email", () => {
    const hit = { ...base, gmail_thread_id: "t1" };
    expect(sourceState(hit)).toBe("email");
    expect(sourceLabel(sourceState(hit))).toBe("Open email");
  });

  it("attachment-only source → View resume", () => {
    const hit: EvidenceHit = {
      ...base,
      gmail_thread_id: null,
      resume_file_name: "priya-cv.pdf",
      resume_storage_path: "u/1/priya-cv.pdf",
    };
    expect(sourceState(hit)).toBe("attachment");
    expect(sourceLabel(sourceState(hit))).toBe("View resume");
  });

  it("email plus attachment → compact Evidence action", () => {
    const hit: EvidenceHit = { ...base, gmail_thread_id: "t1", resume_file_name: "cv.pdf" };
    expect(sourceState(hit)).toBe("multiple");
    expect(sourceLabel(sourceState(hit))).toBe("Evidence");
  });

  it("archive person keeps an evidence path", () => {
    const hit: EvidenceHit = { ...base, origin: "archive", gmail_message_id: "archive:1", email_candidate_id: "p1" };
    expect(sourceState(hit)).toBe("multiple");
  });

  it("no email and no attachment → no source available", () => {
    const hit: EvidenceHit = { ...base, gmail_thread_id: null };
    expect(sourceState(hit)).toBe("none");
    expect(sourceLabel(sourceState(hit))).toBe("No source available");
  });
});

describe("evidence chips", () => {
  it("shows supported facts and the source filename", () => {
    const labels = evidenceChips({ ...base, resume_file_name: "priya-cv.pdf" }).map((c) => c.label);
    expect(labels).toEqual(expect.arrayContaining(["Fashion Designer", "7 yrs", "Mumbai", "priya-cv.pdf"]));
  });

  it("never shows unsupported query words like senior", () => {
    const labels = evidenceChips({
      ...base,
      score_parts: { matched: ["senior", "fashion designer"], missing: [] },
      extracted: { role: "Fashion Designer", experience: "7 years", location: "Mumbai", skills: ["senior"] },
    }).map((c) => c.label.toLowerCase());
    expect(labels).not.toContain("senior");
  });

  it("no file → no resume chip", () => {
    const labels = evidenceChips({ ...base }).map((c) => c.kind);
    expect(labels).not.toContain("file");
  });
});