import { z } from "zod";

// Actor IDs — swap via env if you prefer different actors.
// LinkedIn actors on Apify are paid (~$1–5 per 1000 profiles).
export const APIFY_ACTORS = {
  linkedin:
    process.env.APIFY_LINKEDIN_ACTOR ?? "harvestapi~linkedin-profile-search",
  github: process.env.APIFY_GITHUB_ACTOR ?? "kawsar~github-profile-scraper",
} as const;

export type ApifySourceId = keyof typeof APIFY_ACTORS;

export type NormalizedProfile = {
  source: ApifySourceId;
  source_profile_id: string;
  name: string;
  headline: string | null;
  current_company: string | null;
  location: string | null;
  experience_years: number | null;
  skills: string[];
  email: string | null;
  phone: string | null;
  profile_url: string | null;
  avatar_url: string | null;
  raw: Record<string, unknown>;
};

export async function callApifyActor(
  actorId: string,
  input: Record<string, unknown>,
  opts: { timeoutMs?: number } = {},
): Promise<unknown[]> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) throw new Error("APIFY_API_TOKEN is not configured");

  // run-sync-get-dataset-items waits for the actor to finish and returns
  // the dataset items in a single call. Good for small batches (<5 min runs).
  const url = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${token}&timeout=${Math.floor((opts.timeoutMs ?? 5 * 60_000) / 1000)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Apify actor ${actorId} failed [${res.status}]: ${txt.slice(0, 500)}`);
  }

  const json = (await res.json()) as unknown;
  if (!Array.isArray(json)) return [];
  return json;
}

// ---------- GitHub via public REST API ----------
// The Apify GitHub actor is flaky and costs money. GitHub's own search API
// is free (60 req/h unauth, 5000 req/h with GITHUB_TOKEN) and far more reliable.
export async function searchGitHubUsers(args: {
  jobTitle: string;
  location?: string | null;
  skills?: string[];
  maxResults: number;
}): Promise<NormalizedProfile[]> {
  const ghToken = process.env.GITHUB_TOKEN;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "lovable-scout",
  };
  if (ghToken) headers.Authorization = `Bearer ${ghToken}`;

  // Build a GitHub user search query. Skills/title become free-text terms
  // (matched against name/login/bio). Location uses the `location:` qualifier.
  const terms: string[] = [];
  if (args.jobTitle) terms.push(args.jobTitle);
  for (const s of args.skills ?? []) {
    if (s.trim()) terms.push(s.trim());
  }
  const q = terms.map((t) => (/\s/.test(t) ? `"${t.replace(/"/g, "")}"` : t)).join(" ");
  const loc = args.location?.trim()
    ? ` location:"${args.location.trim().replace(/"/g, "")}"`
    : "";
  const url = `https://api.github.com/search/users?q=${encodeURIComponent(q + loc + " type:user")}&per_page=${Math.min(args.maxResults, 30)}`;

  const res = await fetch(url, { headers });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`GitHub search failed [${res.status}]: ${txt.slice(0, 300)}`);
  }
  const json = (await res.json()) as { items?: { login: string; url: string }[] };
  const items = json.items ?? [];
  if (!items.length) return [];

  // Fetch full profiles in parallel (capped) to enrich name/bio/company/location.
  const detailed = await Promise.all(
    items.slice(0, args.maxResults).map(async (it) => {
      try {
        const r = await fetch(it.url, { headers });
        if (!r.ok) return null;
        return (await r.json()) as Record<string, unknown>;
      } catch {
        return null;
      }
    }),
  );

  const out: NormalizedProfile[] = [];
  for (const d of detailed) {
    if (!d) continue;
    const norm = normalizeGitHubApi(d);
    if (norm) out.push(norm);
  }
  return out;
}

function normalizeGitHubApi(o: Record<string, unknown>): NormalizedProfile | null {
  const login = pickString(o.login);
  if (!login) return null;
  const name = pickString(o.name, o.login)!;
  return {
    source: "github",
    source_profile_id: login,
    name,
    headline: pickString(o.bio),
    current_company: pickString(o.company),
    location: pickString(o.location),
    experience_years: null,
    skills: [],
    email: pickString(o.email),
    phone: null,
    profile_url: pickString(o.html_url, o.url),
    avatar_url: pickString(o.avatar_url),
    raw: o,
  };
}

function pickString(...vals: unknown[]): string | null {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function pickNumber(...vals: unknown[]): number | null {
  for (const v of vals) {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
      const n = parseFloat(v);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

function pickStringArray(...vals: unknown[]): string[] {
  for (const v of vals) {
    if (Array.isArray(v)) {
      const out = v
        .map((x) => {
          if (typeof x === "string") return x;
          if (x && typeof x === "object") {
            const obj = x as Record<string, unknown>;
            return (
              (typeof obj.name === "string" && obj.name) ||
              (typeof obj.skill === "string" && obj.skill) ||
              ""
            );
          }
          return "";
        })
        .map((s) => s.trim())
        .filter(Boolean);
      if (out.length) return Array.from(new Set(out)).slice(0, 30);
    }
  }
  return [];
}

// LinkedIn actor outputs vary; this tolerantly maps common shapes.
export function normalizeLinkedIn(item: unknown): NormalizedProfile | null {
  if (!item || typeof item !== "object") return null;
  const o = item as Record<string, unknown>;
  const id = pickString(o.publicIdentifier, o.publicId, o.profileId, o.id, o.url);
  const name = pickString(
    o.fullName,
    o.name,
    [o.firstName, o.lastName].filter(Boolean).join(" "),
  );
  if (!id || !name) return null;
  return {
    source: "linkedin",
    source_profile_id: id,
    name,
    headline: pickString(o.headline, o.subTitle, o.occupation),
    current_company: pickString(
      o.companyName,
      (o.currentCompany as Record<string, unknown> | undefined)?.name,
      o.company,
    ),
    location: pickString(o.location, o.geoLocationName, o.addressWithCountry),
    experience_years: pickNumber(o.experienceYears, o.yearsOfExperience),
    skills: pickStringArray(o.skills, o.topSkills),
    email: pickString(o.email, o.emailAddress),
    phone: pickString(o.phone, o.phoneNumber, o.mobile),
    profile_url: pickString(o.url, o.profileUrl, o.linkedinUrl),
    avatar_url: pickString(o.profilePicture, o.pictureUrl, o.avatar),
    raw: o,
  };
}

export function normalizeGitHub(item: unknown): NormalizedProfile | null {
  if (!item || typeof item !== "object") return null;
  const o = item as Record<string, unknown>;
  const id = pickString(o.login, o.username, o.id);
  const name = pickString(o.name, o.fullName, o.login);
  if (!id || !name) return null;
  return {
    source: "github",
    source_profile_id: id,
    name,
    headline: pickString(o.bio, o.headline),
    current_company: pickString(o.company),
    location: pickString(o.location),
    experience_years: null,
    skills: pickStringArray(o.languages, o.topLanguages, o.skills),
    email: pickString(o.email, o.publicEmail), // only if public
    phone: null,
    profile_url: pickString(o.htmlUrl, o.url, o.profileUrl),
    avatar_url: pickString(o.avatarUrl, o.avatar_url),
    raw: o,
  };
}

export function buildActorInput(
  source: ApifySourceId,
  args: { jobTitle: string; location?: string | null; skills?: string[]; maxResults: number },
): Record<string, unknown> {
  const keywords = [args.jobTitle, ...(args.skills ?? [])].filter(Boolean).join(" ");
  if (source === "linkedin") {
    return {
      // Most LinkedIn search-scrapers accept these. Adjust if you swap actor.
      currentJobTitle: args.jobTitle,
      keywords,
      locations: args.location ? [args.location] : [],
      maxItems: args.maxResults,
    };
  }
  // github
  const qParts = [args.jobTitle, ...(args.skills ?? [])]
    .filter(Boolean)
    .map((s) => `"${s.replace(/"/g, "")}"`);
  if (args.location) qParts.push(`location:"${args.location}"`);
  return {
    queries: [qParts.join(" ")],
    maxItems: args.maxResults,
    type: "users",
  };
}

export function normalizeForSource(source: ApifySourceId, item: unknown) {
  return source === "linkedin" ? normalizeLinkedIn(item) : normalizeGitHub(item);
}

// ----- Gemini batched ranking -----

const RankSchema = z.object({
  results: z.array(
    z.object({
      id: z.string(),
      matchScore: z.number().min(0).max(100),
      reasoning: z.string().max(400),
    }),
  ),
});

export type RankInput = {
  id: string;
  name: string;
  headline: string | null;
  current_company: string | null;
  location: string | null;
  experience_years: number | null;
  skills: string[];
};

export async function rankBatch(jdText: string, candidates: RankInput[]) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

  const candidateLines = candidates
    .map(
      (c) =>
        `${c.id} | ${c.name} | ${c.headline ?? ""} @ ${c.current_company ?? "—"} | ${c.location ?? "—"} | ${c.experience_years ?? "?"}y | skills: ${c.skills.slice(0, 12).join(", ")}`,
    )
    .join("\n");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content:
            "You rank candidates against a job description. Score 0-100 honestly. Give 1-2 sentence reasoning per candidate. Return ONLY via the rank_candidates tool.",
        },
        {
          role: "user",
          content: `JOB DESCRIPTION:\n${jdText}\n\nCANDIDATES (id | name | headline @ company | location | experience | skills):\n${candidateLines}`,
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "rank_candidates",
            description: "Return a score and reasoning for every candidate id provided.",
            parameters: {
              type: "object",
              properties: {
                results: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      matchScore: { type: "number", minimum: 0, maximum: 100 },
                      reasoning: { type: "string" },
                    },
                    required: ["id", "matchScore", "reasoning"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["results"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "rank_candidates" } },
    }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`AI ranking failed [${res.status}]: ${txt.slice(0, 300)}`);
  }

  const json = (await res.json()) as {
    choices?: { message?: { tool_calls?: { function?: { arguments?: string } }[] } }[];
  };
  const args = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) return [];
  const parsed = RankSchema.safeParse(JSON.parse(args));
  return parsed.success ? parsed.data.results : [];
}