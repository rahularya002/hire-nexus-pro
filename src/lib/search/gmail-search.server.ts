// Compile a SearchPlan into a small ladder of Gmail queries. Retrieval only —
// precision (years, location, skills) is decided after hydration.
import { listMessageIds } from "../gmail.server";
import type { SearchPlan } from "./query-plan.server";

const NOISE = [
  "-from:noreply",
  "-from:no-reply",
  "-from:donotreply",
  "-from:do-not-reply",
  "-from:statements",
  "-from:billing",
  "-from:invoice",
  "-from:newsletter",
  "-category:promotions",
  "-category:social",
  "-label:spam",
].join(" ");

const ATTACHMENT = "has:attachment (filename:pdf OR filename:doc OR filename:docx)";

function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}/${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

function orGroup(terms: string[]): string | null {
  const list = terms
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 8)
    .map((t) => (t.includes(" ") ? `"${t}"` : t));
  return list.length ? `(${list.join(" OR ")})` : null;
}

/**
 * 2-4 query variants, widening as we go. The runner walks them in order and
 * stops as soon as the hit target or the listing budget is reached.
 */
export function buildSearchQueries(plan: SearchPlan): string[] {
  const subject = [...plan.roles, ...plan.skills, ...plan.keywords];
  const roleGroup = orGroup([...plan.roles, ...plan.skills.slice(0, 4)]) ?? orGroup(plan.keywords);
  const locGroup = orGroup(plan.locations);
  const scope: string[] = [];
  if (plan.dateFrom) scope.push(`after:${fmtDate(plan.dateFrom)}`);
  for (const l of plan.labels.filter(Boolean).slice(0, 5)) scope.push(`label:"${l}"`);
  const tail = [...scope, NOISE].join(" ");

  const queries: string[] = [];
  const push = (q: string) => {
    const norm = q.replace(/\s+/g, " ").trim();
    if (norm && !queries.includes(norm)) queries.push(norm);
  };

  // Resume-bearing mail first (highest precision), then the same terms without an
  // attachment requirement so email-only candidates ("submitted to Myntra",
  // "immediate availability") are still retrieved.
  if (roleGroup && locGroup) push(`${ATTACHMENT} ${roleGroup} ${locGroup} ${tail}`);
  if (roleGroup) push(`${ATTACHMENT} ${roleGroup} ${tail}`);
  if (roleGroup && locGroup) push(`${roleGroup} ${locGroup} ${tail}`);
  if (roleGroup) push(`${roleGroup} ${tail}`);

  const anyGroup = orGroup(subject);
  if (anyGroup) push(`${ATTACHMENT} (resume OR cv OR profile) ${anyGroup} ${tail}`);
  if (anyGroup) push(`${anyGroup} ${tail}`);

  if (!roleGroup && !anyGroup) {
    // No usable terms at all: resume-shaped mail in scope, then recruitment talk.
    push(`${ATTACHMENT} (resume OR cv OR profile OR candidate) ${tail}`);
    push(`(resume OR cv OR candidate OR shortlist OR "notice period" OR "available immediately") ${tail}`);
  }

  return queries.slice(0, 6);
}

export type ListedRef = { id: string; threadId: string | null };

/** One Gmail listing page for the current query variant. */
export async function listSearchPage(
  accessToken: string,
  queries: string[],
  queryIndex: number,
  pageToken: string | null,
  pageSize: number,
): Promise<{ refs: ListedRef[]; nextPageToken: string | null; nextQueryIndex: number; exhausted: boolean }> {
  let idx = queryIndex;
  let token = pageToken;
  for (; idx < queries.length; idx++) {
    const q = queries[idx]!;
    const page = await listMessageIds(accessToken, q, token, pageSize);
    const refs = page.messages.map((m) => ({ id: m.id, threadId: m.threadId ?? null }));
    if (page.nextPageToken) {
      return { refs, nextPageToken: page.nextPageToken, nextQueryIndex: idx, exhausted: false };
    }
    // This variant is finished — move on to the next, wider one.
    if (refs.length) {
      return { refs, nextPageToken: null, nextQueryIndex: idx + 1, exhausted: idx + 1 >= queries.length };
    }
    token = null;
  }
  return { refs: [], nextPageToken: null, nextQueryIndex: idx, exhausted: true };
}