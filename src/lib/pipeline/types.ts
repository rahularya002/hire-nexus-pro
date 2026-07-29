// Source-agnostic pipeline contracts. Gmail is only one Discovery implementation;
// LinkedIn / Drive / ATS importers can produce the same shapes later.
import type { Classification, Extracted } from "../recruitment-classify.server";
import type { Facet } from "./config";

export type RawAttachment = {
  /** Opaque id the discovery source uses to fetch bytes. */
  externalId: string;
  fileName: string;
  mimeType: string | null;
  size: number;
};

export type RawItem = {
  source: "gmail" | "upload" | "drive" | "linkedin" | "ats";
  externalId: string;
  threadId: string | null;
  subject: string | null;
  snippet: string | null;
  fromEmail: string | null;
  fromName: string | null;
  toEmails: string[];
  bodyText: string;
  sentAt: string | null;
  attachments: RawAttachment[];
};

export type FieldCoverage = Record<Facet, number>;

export type NormalizedItem = {
  raw: RawItem;
  /** Cleaned, quote/signature-stripped body ready for a prompt. */
  cleanBody: string;
  /** Plain text of the primary attachment, if any. */
  docText: string;
  /** sha256 of every attachment's bytes, in the same order as raw.attachments. */
  attachmentHashes: string[];
  /** Fields we pulled out with regex/rules — no AI involved. */
  fields: Extracted;
  coverage: FieldCoverage;
  /** Facets still below their target and therefore worth asking the model about. */
  gaps: Facet[];
};

export type ClassifiedItem = NormalizedItem & {
  classification: Classification;
  /** Where the verdict came from — used for run instrumentation. */
  route: "rules-import" | "rules-skip" | "cache" | "ai";
};

export type PipelineMetrics = {
  aiCalls: number;
  cacheHits: number;
  autoImported: number;
  rulesSkipped: number;
  tokensEstimated: number;
};

export function emptyMetrics(): PipelineMetrics {
  return { aiCalls: 0, cacheHits: 0, autoImported: 0, rulesSkipped: 0, tokensEstimated: 0 };
}