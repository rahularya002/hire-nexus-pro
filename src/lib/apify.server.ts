import { z } from "zod";

// Actor IDs — swap via env if you prefer different actors.
// LinkedIn actors on Apify are paid (~$1–5 per 1000 profiles).
export const APIFY_ACTORS = {
  linkedin:
    process.env.APIFY_LINKEDIN_ACTOR ?? "harvestapi~linkedin-profile-search",
  github: process.env.APIFY_GITHUB_ACTOR ?? "kawsar~github-profile-scraper",
  naukri: process.env.APIFY_NAUKRI_ACTOR ?? "jupri~naukri-scraper",
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
  open_to_work: boolean;
  is_hiring: boolean;
  raw: Record<string, unknown>;
};

// ---------- Mock Naukri profiles (temporary; used until Naukri cookie/actor is wired) ----------

const MOCK_NAUKRI_POOL = [
  { name: "Aarav Sharma",     company: "Infosys",       location: "Bengaluru", exp: 6,  skills: ["java", "spring boot", "microservices", "kafka", "aws"], headline: "Senior Software Engineer" },
  { name: "Priya Iyer",       company: "TCS",           location: "Pune",      exp: 4,  skills: ["react", "typescript", "node.js", "graphql", "aws"],  headline: "Frontend Engineer" },
  { name: "Rohan Verma",      company: "Flipkart",      location: "Bengaluru", exp: 8,  skills: ["python", "django", "postgres", "redis", "aws"],       headline: "Staff Backend Engineer" },
  { name: "Sneha Kapoor",     company: "Razorpay",      location: "Bengaluru", exp: 5,  skills: ["go", "kubernetes", "grpc", "postgres"],               headline: "SDE-2, Payments" },
  { name: "Karthik Menon",    company: "Zomato",        location: "Gurugram",  exp: 7,  skills: ["react native", "ios", "android", "typescript"],       headline: "Mobile Lead" },
  { name: "Ananya Desai",     company: "Swiggy",        location: "Bengaluru", exp: 3,  skills: ["python", "pandas", "sql", "airflow", "spark"],        headline: "Data Engineer" },
  { name: "Vikram Rao",       company: "Paytm",         location: "Noida",     exp: 9,  skills: ["java", "kafka", "cassandra", "system design"],        headline: "Principal Engineer" },
  { name: "Meera Nair",       company: "Cred",          location: "Bengaluru", exp: 5,  skills: ["kotlin", "android", "coroutines", "jetpack compose"],headline: "Android Engineer" },
  { name: "Aditya Joshi",     company: "Nykaa",         location: "Mumbai",    exp: 4,  skills: ["node.js", "express", "mongodb", "aws", "typescript"], headline: "Backend Engineer" },
  { name: "Ishita Bansal",    company: "PhonePe",       location: "Bengaluru", exp: 6,  skills: ["java", "spring", "kafka", "mysql", "microservices"], headline: "SDE-3" },
  { name: "Rahul Choudhary",  company: "Meesho",        location: "Bengaluru", exp: 3,  skills: ["react", "next.js", "typescript", "tailwind"],         headline: "Frontend Engineer" },
  { name: "Divya Reddy",      company: "Zerodha",       location: "Bengaluru", exp: 7,  skills: ["python", "fastapi", "postgres", "redis", "docker"],  headline: "Senior Backend Engineer" },
  { name: "Sahil Khan",       company: "Tata Digital",  location: "Mumbai",    exp: 10, skills: ["java", "spring boot", "aws", "system design", "kafka"], headline: "Engineering Manager" },
  { name: "Neha Gupta",       company: "Reliance Jio",  location: "Mumbai",    exp: 5,  skills: ["python", "ml", "tensorflow", "pytorch", "nlp"],       headline: "ML Engineer" },
  { name: "Manish Patel",     company: "Ola",           location: "Bengaluru", exp: 6,  skills: ["go", "kubernetes", "grpc", "aws"],                    headline: "SDE-2, Platform" },
  { name: "Riya Malhotra",    company: "Urban Company", location: "Gurugram",  exp: 4,  skills: ["react", "redux", "typescript", "node.js"],            headline: "Full Stack Engineer" },
  { name: "Arjun Pillai",     company: "Freshworks",    location: "Chennai",   exp: 8,  skills: ["ruby", "rails", "postgres", "aws", "sidekiq"],        headline: "Senior Software Engineer" },
  { name: "Pooja Saxena",     company: "Postman",       location: "Bengaluru", exp: 5,  skills: ["javascript", "electron", "react", "node.js"],         headline: "Product Engineer" },
];

function slugifyName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function normalizeSkillToken(v: string) {
  return v.toLowerCase().replace(/[^a-z0-9+#.]+/g, " ").trim();
}

function scoreMockAgainst(
  profile: (typeof MOCK_NAUKRI_POOL)[number],
  jobTitle: string,
  skills: string[],
  location?: string,
) {
  let score = 0;
  const title = jobTitle.toLowerCase();
  const headline = profile.headline.toLowerCase();
  const titleTokens = title.split(/\s+/).filter((t) => t.length > 2);
  for (const tok of titleTokens) if (headline.includes(tok)) score += 3;
  const reqSkills = skills.map(normalizeSkillToken).filter(Boolean);
  const candSkills = profile.skills.map(normalizeSkillToken);
  for (const s of reqSkills) if (candSkills.some((c) => c.includes(s) || s.includes(c))) score += 5;
  if (location && profile.location.toLowerCase().includes(location.toLowerCase())) score += 2;
  return score;
}

export function generateMockNaukriProfiles(opts: {
  jobTitle: string;
  location?: string;
  skills?: string[];
  maxResults: number;
}): NormalizedProfile[] {
  const skills = opts.skills ?? [];
  const ranked = MOCK_NAUKRI_POOL
    .map((p) => ({ p, s: scoreMockAgainst(p, opts.jobTitle, skills, opts.location) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, Math.max(1, Math.min(opts.maxResults, MOCK_NAUKRI_POOL.length)));

  return ranked.map(({ p }, idx) => {
    const slug = slugifyName(p.name);
    return {
      source: "naukri" as const,
      source_profile_id: `mock-${slug}-${idx}`,
      name: p.name,
      headline: `${p.headline} @ ${p.company}`,
      current_company: p.company,
      location: p.location,
      experience_years: p.exp,
      skills: p.skills,
      email: `${slug}@example.com`,
      phone: `+91 9${String(90000000 + (slug.length * 137 + idx * 991) % 99999999).padStart(9, "0")}`,
      profile_url: `https://www.naukri.com/mnjuser/profile/${slug}`,
      avatar_url: null,
      open_to_work: idx % 3 === 0,
      is_hiring: false,
      raw: { mock: true, seed: "naukri" },
    } satisfies NormalizedProfile;
  });
}


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
    open_to_work: false,
    is_hiring: false,
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
const OTW_TEXT_RE = /#?open[\s-]?to[\s-]?work|open for opportunities|open for new opportunities|looking for (a )?new (role|opportunit|job)|actively (seeking|looking)|available for (hire|new role|opportunit)|seeking (new|next) (role|opportunit|job)|exploring new opportunit/i;

const HIRING_TITLE_RE = /\b(recruiter|recruitment|talent acquisition|talent partner|talent sourc|technical sourc|sourcer|head of (talent|people|hr|recruit)|hr (manager|business partner|director|lead)|people ops|people operations|chief people|chro)\b/i;
const HIRING_TEXT_RE = /#hiring\b|we['\u2019]?re hiring|we are hiring|now hiring|currently hiring|join (our|the) team|join us|apply (here|now|via)|dm (me )?(your )?(cv|resume)|send (me )?(your )?(cv|resume)|hiring (multiple|several|\w+ )?(engineer|developer|designer|manager|role|position)|open (roles?|positions?) (at|in)/i;

function collectText(o: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const k of ["headline", "subTitle", "occupation", "about", "summary", "bio", "description", "jobTitle", "position"]) {
    const v = o[k];
    if (typeof v === "string") parts.push(v);
  }
  return parts.join(" \n ");
}

export function detectOpenToWork(o: Record<string, unknown>): boolean {
  if (o.openToWork === true || o.isOpenToWork === true) return true;
  if (typeof o.openToWorkStatus === "string" && o.openToWorkStatus.trim()) return true;
  if (o.hasOpenToWorkPhotoFrame === true || o.openToWorkPhotoFrame === true) return true;
  const frame = typeof o.profilePictureFrame === "string" ? o.profilePictureFrame.toLowerCase() : "";
  if (frame.includes("opentowork") || frame.includes("open_to_work")) return true;
  const status = typeof o.jobSeekerStatus === "string" ? o.jobSeekerStatus.toLowerCase()
    : typeof o.jobSearchStatus === "string" ? o.jobSearchStatus.toLowerCase() : "";
  if (status && (status.includes("active") || status.includes("open") || status.includes("looking"))) return true;
  return OTW_TEXT_RE.test(collectText(o));
}

export function detectHiringProfile(o: Record<string, unknown>): boolean {
  if (o.openToHiring === true || o.isHiring === true) return true;
  if (typeof o.hiringStatus === "string" && o.hiringStatus.trim()) return true;
  const frame = typeof o.profilePictureFrame === "string" ? o.profilePictureFrame.toLowerCase() : "";
  if (frame.includes("hiring")) return true;
  const headline = [o.headline, o.subTitle, o.occupation, o.jobTitle, o.position]
    .filter((v) => typeof v === "string")
    .join(" \n ");
  if (HIRING_TITLE_RE.test(headline)) return true;
  return HIRING_TEXT_RE.test(collectText(o));
}

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
  const openToWork = detectOpenToWork(o);
  const isHiring = detectHiringProfile(o);
  // Exclude recruiters / "we're hiring" posts entirely — unless the person is
  // also open to work themselves (rare but legitimate).
  if (isHiring && !openToWork) return null;

  const firstExp = Array.isArray(o.experience) && o.experience.length
    ? (o.experience[0] as Record<string, unknown>)
    : null;

  return {
    source: "linkedin",
    source_profile_id: id,
    name,
    headline: pickString(
      o.headline,
      o.subTitle,
      o.occupation,
      o.jobTitle,
      o.position,
      (o.currentPosition as Record<string, unknown> | undefined)?.title,
      firstExp?.title,
    ),
    current_company: pickString(
      o.companyName,
      (o.currentCompany as Record<string, unknown> | undefined)?.name,
      o.company,
      (o.currentPosition as Record<string, unknown> | undefined)?.companyName,
      firstExp?.companyName,
      firstExp?.company,
    ),
    location: pickString(o.location, o.geoLocationName, o.addressWithCountry),
    experience_years: pickNumber(o.experienceYears, o.yearsOfExperience),
    skills: pickStringArray(o.skills, o.topSkills),
    email: pickString(o.email, o.emailAddress),
    phone: pickString(o.phone, o.phoneNumber, o.mobile),
    profile_url: pickString(o.url, o.profileUrl, o.linkedinUrl),
    avatar_url: pickString(o.profilePicture, o.pictureUrl, o.avatar),
    open_to_work: openToWork,
    is_hiring: isHiring,
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
    open_to_work: false,
    is_hiring: false,
    raw: o,
  };
}

export function normalizeNaukri(item: unknown): NormalizedProfile | null {
  if (!item || typeof item !== "object") return null;
  const o = item as Record<string, unknown>;
  const id = pickString(o.profileId, o.resdexId, o.id, o.profileUrl, o.url);
  const name = pickString(o.name, o.fullName, o.candidateName);
  if (!id || !name) return null;
  const expRaw = pickString(o.totalExperience, o.experience, o.totalExp);
  const expYears = pickNumber(o.totalExperienceYears, o.experienceYears, expRaw);
  return {
    source: "naukri",
    source_profile_id: id,
    name,
    headline: pickString(o.designation, o.title, o.currentRole, o.headline),
    current_company: pickString(o.currentCompany, o.company, o.employer),
    location: pickString(o.location, o.currentLocation, o.city),
    experience_years: expYears,
    skills: pickStringArray(o.keySkills, o.skills, o.itSkills),
    email: pickString(o.email, o.emailId, o.emailAddress),
    phone: pickString(o.mobile, o.phone, o.mobileNumber, o.phoneNumber),
    profile_url: pickString(o.profileUrl, o.url, o.resumeUrl),
    avatar_url: pickString(o.profilePicture, o.avatar, o.photoUrl),
    open_to_work: o.activeStatus === "active" || o.isActive === true || false,
    is_hiring: false,
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
      // harvestapi~linkedin-profile-search input schema.
      profileScraperMode: "Full + email search",
      searchQuery: args.jobTitle,
      currentJobTitles: [args.jobTitle],
      locations: args.location ? [args.location] : [],
      maxItems: args.maxResults,
    };
  }
  if (source === "naukri") {
    // Most Naukri actors accept keyword + location + experience + pagination.
    // NAUKRI_COOKIE unlocks Resdex-level access (emails/phones) when the
    // user pastes a logged-in recruiter session cookie.
    return {
      keyword: keywords,
      keywords,
      location: args.location ?? "",
      locations: args.location ? [args.location] : [],
      maxItems: args.maxResults,
      maxResults: args.maxResults,
      cookie: process.env.NAUKRI_COOKIE ?? undefined,
      cookies: process.env.NAUKRI_COOKIE ?? undefined,
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
  if (source === "linkedin") return normalizeLinkedIn(item);
  if ((source as string) === "naukri") return normalizeNaukri(item);
  return normalizeGitHub(item);
}

// ---------- Email enrichment ----------
// LinkedIn public search actors almost never return emails. This runs after
// scouting to fill missing emails using either Hunter.io (if HUNTER_API_KEY
// is configured) or a generic Apify email-finder actor as fallback.
export async function enrichEmails(profiles: NormalizedProfile[], limit = 20): Promise<NormalizedProfile[]> {
  const targets = profiles.filter((p) => !p.email && p.name).slice(0, limit);
  if (!targets.length) return profiles;
  const hunterKey = process.env.HUNTER_API_KEY;

  await Promise.all(
    targets.map(async (p) => {
      try {
        const [firstName, ...rest] = p.name.split(/\s+/);
        const lastName = rest.join(" ");
        const domain = guessCompanyDomain(p.current_company);
        if (hunterKey && firstName && lastName && domain) {
          const u = new URL("https://api.hunter.io/v2/email-finder");
          u.searchParams.set("domain", domain);
          u.searchParams.set("first_name", firstName);
          u.searchParams.set("last_name", lastName);
          u.searchParams.set("api_key", hunterKey);
          const r = await fetch(u.toString());
          if (r.ok) {
            const j = (await r.json()) as { data?: { email?: string; score?: number } };
            const email = j.data?.email;
            if (email && (j.data?.score ?? 0) >= 50) p.email = email;
          }
          return;
        }
        // Fallback: Apify contact-info-scraper on the profile URL
        if (p.profile_url && process.env.APIFY_API_TOKEN) {
          const actor = process.env.APIFY_EMAIL_FINDER_ACTOR ?? "vdrmota~contact-info-scraper";
          const items = await callApifyActor(actor, {
            startUrls: [{ url: p.profile_url }],
            maxRequestsPerCrawl: 1,
          }, { timeoutMs: 60_000 }).catch(() => [] as unknown[]);
          for (const it of items) {
            const obj = it as Record<string, unknown>;
            const emails = Array.isArray(obj.emails) ? (obj.emails as unknown[]) : [];
            const first = emails.find((e): e is string => typeof e === "string");
            if (first) { p.email = first; break; }
          }
        }
      } catch (e) {
        console.warn("Email enrichment failed for", p.name, e);
      }
    }),
  );
  return profiles;
}

function guessCompanyDomain(company: string | null): string | null {
  if (!company) return null;
  const slug = company
    .toLowerCase()
    .replace(/\b(inc|llc|ltd|limited|pvt|private|corp|corporation|technologies|technology|labs|labs\.|solutions|systems|group|the)\b/g, "")
    .replace(/[^a-z0-9]+/g, "");
  if (!slug || slug.length < 2) return null;
  return `${slug}.com`;
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
  open_to_work?: boolean;
};

export async function rankBatch(jdText: string, candidates: RankInput[]) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

  const candidateLines = candidates
    .map(
      (c) =>
        `${c.id} | ${c.name} | ${c.headline ?? ""} @ ${c.current_company ?? "—"} | ${c.location ?? "—"} | ${c.experience_years ?? "?"}y | OTW:${c.open_to_work ? "yes" : "no"} | skills: ${c.skills.slice(0, 12).join(", ")}`,
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
            "You rank candidates against a job description. Score 0-100 honestly. Candidates marked OTW:yes are explicitly open to work — give them a meaningful score boost. Give 1-2 sentence reasoning per candidate. Return ONLY via the rank_candidates tool.",
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