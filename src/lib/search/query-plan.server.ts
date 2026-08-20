// Turn a recruiter's natural-language line into a structured retrieval plan.
// Deterministic parse first; one cheap model call only when the parse is thin.

export type SearchPlan = {
  roles: string[];
  skills: string[];
  locations: string[];
  minYears: number | null;
  maxYears: number | null;
  salaryMin: number | null;
  salaryMax: number | null;
  keywords: string[];
  dateFrom: string | null;
  labels: string[];
};

export function emptyPlan(): SearchPlan {
  return {
    roles: [],
    skills: [],
    locations: [],
    minYears: null,
    maxYears: null,
    salaryMin: null,
    salaryMax: null,
    keywords: [],
    dateFrom: null,
    labels: [],
  };
}

/** City groups so "Delhi" also retrieves NCR mail and "Bombay" matches Mumbai. */
export const LOCATION_ALIASES: Record<string, string[]> = {
  delhi: ["delhi", "new delhi", "ncr", "noida", "gurgaon", "gurugram", "faridabad", "ghaziabad"],
  mumbai: ["mumbai", "bombay", "navi mumbai", "thane"],
  bengaluru: ["bengaluru", "bangalore", "blr"],
  hyderabad: ["hyderabad", "secunderabad"],
  pune: ["pune", "pimpri"],
  chennai: ["chennai", "madras"],
  kolkata: ["kolkata", "calcutta"],
  ahmedabad: ["ahmedabad", "gandhinagar"],
  kochi: ["kochi", "cochin", "ernakulam"],
};

const KNOWN_CITIES = [
  ...Object.keys(LOCATION_ALIASES),
  "new delhi","bombay","bangalore","jaipur","indore","chandigarh","coimbatore","nagpur","lucknow",
  "bhopal","vadodara","surat","mysore","remote","singapore","dubai","london","new york",
  "san francisco","berlin","toronto","sydney","abu dhabi","riyadh","doha",
];

const ROLE_WORDS = [
  "designer","developer","engineer","manager","analyst","architect","consultant","recruiter","accountant",
  "executive","lead","director","specialist","technician","officer","assistant","associate","scientist",
  "administrator","merchandiser","stylist","copywriter","marketer","tester","nurse","teacher","chef",
  "supervisor","coordinator","planner","buyer","operator","sales","hr","devops","intern","head",
];

const STOPWORDS = new Set([
  "find","get","show","me","search","for","with","and","or","in","at","the","a","an","who","have","has",
  "having","years","year","yrs","yr","experience","exp","of","from","candidates","candidate","profiles",
  "profile","resumes","resume","cvs","cv","people","someone","any","please","looking","need","want",
  "based","around","near","plus","min","minimum","max","maximum","lpa","lakh","lakhs","salary","ctc",
  "package","last","months","month","days","day","recently","between","to","upto","up",
]);

/** Multi-word role phrases we want to keep intact for Gmail phrase search. */
function rolePhrases(text: string): string[] {
  const out: string[] = [];
  const words = text.split(/[^a-z0-9+.#/&]+/i).filter(Boolean);
  for (let i = 0; i < words.length; i++) {
    const w = (words[i] ?? "").toLowerCase();
    if (!ROLE_WORDS.includes(w)) continue;
    const prev = (words[i - 1] ?? "").toLowerCase();
    const prev2 = (words[i - 2] ?? "").toLowerCase();
    const singular = w.replace(/s$/, "") === w ? w : w;
    if (prev && !STOPWORDS.has(prev) && !KNOWN_CITIES.includes(prev)) {
      if (prev2 && !STOPWORDS.has(prev2) && !KNOWN_CITIES.includes(prev2) && ROLE_WORDS.includes(w)) {
        out.push(`${prev2} ${prev} ${singular}`);
      }
      out.push(`${prev} ${singular}`);
    }
    out.push(singular);
  }
  return Array.from(new Set(out));
}

function parseYears(text: string): { min: number | null; max: number | null } {
  const range = text.match(/(\d{1,2})\s*(?:-|to|–)\s*(\d{1,2})\s*\+?\s*(?:years?|yrs?|yr)\b/i);
  if (range) return { min: Number(range[1]), max: Number(range[2]) };
  const plus = text.match(/(\d{1,2})\s*\+\s*(?:years?|yrs?|yr)?/i);
  if (plus) return { min: Number(plus[1]), max: null };
  const atLeast = text.match(/(?:at least|min(?:imum)?|over|more than)\s*(\d{1,2})\s*(?:years?|yrs?)?/i);
  if (atLeast) return { min: Number(atLeast[1]), max: null };
  const simple = text.match(/(\d{1,2})\s*(?:years?|yrs?|yr)\b/i);
  if (simple) return { min: Number(simple[1]), max: null };
  return { min: null, max: null };
}

function parseSalary(text: string): { min: number | null; max: number | null } {
  const range = text.match(/(\d{1,3}(?:\.\d)?)\s*(?:-|to|–)\s*(\d{1,3}(?:\.\d)?)\s*(?:lpa|lakhs?|lacs?)\b/i);
  if (range) return { min: Number(range[1]), max: Number(range[2]) };
  const one = text.match(/(\d{1,3}(?:\.\d)?)\s*(?:lpa|lakhs?|lacs?)\b/i);
  if (one) return { min: Number(one[1]), max: null };
  return { min: null, max: null };
}

function parseDateFrom(text: string): string | null {
  const m = text.match(/last\s+(\d{1,2})\s*(month|months|year|years|day|days|week|weeks)/i);
  if (!m) return null;
  const n = Number(m[1]);
  const unit = (m[2] ?? "").toLowerCase();
  const days = unit.startsWith("year") ? n * 365 : unit.startsWith("month") ? n * 30 : unit.startsWith("week") ? n * 7 : n;
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

export function expandLocations(locations: string[]): string[] {
  const out = new Set<string>();
  for (const l of locations) {
    const key = l.trim().toLowerCase();
    if (!key) continue;
    out.add(key);
    for (const [, group] of Object.entries(LOCATION_ALIASES)) {
      if (group.includes(key)) group.forEach((g) => out.add(g));
    }
  }
  return Array.from(out);
}

/** Rules-only interpretation. Free, instant, and good enough for most queries. */
export function deterministicPlan(raw: string): SearchPlan {
  const text = (raw ?? "").trim();
  const lower = text.toLowerCase();
  const plan = emptyPlan();

  const years = parseYears(lower);
  plan.minYears = years.min;
  plan.maxYears = years.max;
  const sal = parseSalary(lower);
  plan.salaryMin = sal.min;
  plan.salaryMax = sal.max;
  plan.dateFrom = parseDateFrom(lower);

  plan.locations = expandLocations(KNOWN_CITIES.filter((c) => new RegExp(`\\b${c}\\b`, "i").test(lower)));
  plan.roles = rolePhrases(lower).filter((r) => r.split(" ").length <= 3);

  const words = lower.split(/[^a-z0-9+.#/&]+/i).filter(Boolean);
  plan.keywords = Array.from(
    new Set(
      words.filter(
        (w) =>
          w.length >= 3 &&
          !STOPWORDS.has(w) &&
          !/^\d+$/.test(w) &&
          !KNOWN_CITIES.includes(w) &&
          !plan.roles.some((r) => r.split(" ").includes(w)),
      ),
    ),
  ).slice(0, 8);

  return plan;
}

type AiPlan = Partial<{
  roles: string[];
  skills: string[];
  locations: string[];
  min_years: number | null;
  max_years: number | null;
  salary_min_lpa: number | null;
  salary_max_lpa: number | null;
  keywords: string[];
}>;

async function modelPlan(raw: string): Promise<AiPlan | null> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      signal: AbortSignal.timeout(20_000),
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You convert a recruiter's search sentence into structured retrieval terms for searching an email mailbox. " +
              "roles: job titles and close synonyms (e.g. 'fashion designer' -> ['fashion designer','apparel designer','garment designer']). " +
              "skills: concrete skills or tools implied by the role. locations: city names only. " +
              "keywords: other useful search words. Never invent years or salary that were not stated. " +
              "Reply ONLY through the plan_search tool.",
          },
          { role: "user", content: raw.slice(0, 600) },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "plan_search",
              description: "Structured retrieval terms for a recruitment mailbox search.",
              parameters: {
                type: "object",
                properties: {
                  roles: { type: "array", items: { type: "string" } },
                  skills: { type: "array", items: { type: "string" } },
                  locations: { type: "array", items: { type: "string" } },
                  min_years: { type: ["number", "null"] },
                  max_years: { type: ["number", "null"] },
                  salary_min_lpa: { type: ["number", "null"] },
                  salary_max_lpa: { type: ["number", "null"] },
                  keywords: { type: "array", items: { type: "string" } },
                },
                required: ["roles", "skills", "locations", "min_years", "max_years", "salary_min_lpa", "salary_max_lpa", "keywords"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "plan_search" } },
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      choices?: { message?: { tool_calls?: { function?: { arguments?: string } }[] } }[];
    };
    const args = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    return args ? (JSON.parse(args) as AiPlan) : null;
  } catch {
    return null;
  }
}

const clean = (v: unknown, max: number) =>
  Array.isArray(v)
    ? Array.from(
        new Set(
          v
            .filter((x): x is string => typeof x === "string")
            .map((x) => x.trim().toLowerCase())
            .filter((x) => x.length >= 2 && x.length <= 60),
        ),
      ).slice(0, max)
    : [];

const numOrNull = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
/** Models use 0 / -1 as "not specified" sentinels for numeric fields. */
const posOrNull = (v: unknown) => {
  const n = numOrNull(v);
  return n != null && n > 0 ? n : null;
};

/** Deterministic parse, enriched by the model only when it adds real value. */
export async function planSearch(raw: string): Promise<{ plan: SearchPlan; aiCalls: number }> {
  const base = deterministicPlan(raw);
  // Role synonyms materially change Gmail recall, so always try to widen them;
  // if the key is missing or the call fails, the deterministic plan still works.
  const ai = await modelPlan(raw);
  if (!ai) return { plan: base, aiCalls: 0 };

  const plan: SearchPlan = {
    roles: Array.from(new Set([...base.roles, ...clean(ai.roles, 8)])).slice(0, 8),
    skills: Array.from(new Set([...base.skills, ...clean(ai.skills, 12)])).slice(0, 12),
    locations: expandLocations([...base.locations, ...clean(ai.locations, 8)]),
    minYears: base.minYears ?? posOrNull(ai.min_years),
    // "3+ years" is an open-ended floor; models often echo it back as max_years: 3,
    // which would then reject every senior candidate.
    maxYears:
      base.maxYears ??
      (() => {
        const aiMax = posOrNull(ai.max_years);
        const min = base.minYears ?? posOrNull(ai.min_years);
        if (aiMax == null) return null;
        if (min != null && aiMax <= min) return null;
        return aiMax;
      })(),
    salaryMin: base.salaryMin ?? posOrNull(ai.salary_min_lpa),
    salaryMax: base.salaryMax ?? posOrNull(ai.salary_max_lpa),
    keywords: Array.from(new Set([...base.keywords, ...clean(ai.keywords, 10)])).slice(0, 10),
    dateFrom: base.dateFrom,
    labels: base.labels,
  };
  return { plan, aiCalls: 1 };
}