// Semantic occupation matching. A recruiter query like "fashion designers" names
// an occupation, not two independent keywords: "fashion designer" is atomic and
// generic "designer" must never satisfy it. This module is pure and client-safe.

export type OccupationTier = "open" | "specific" | "related" | "generic" | "none";

export type OccupationSpec = {
  /** The phrase as the recruiter expressed it, e.g. "fashion designer". */
  phrase: string;
  /** Head noun family, e.g. designer / design / designing. */
  heads: string[];
  /** Accepted qualifier synonyms, e.g. fashion / apparel / womenswear. */
  qualifiers: string[];
  /** Adjacent-to-nothing titles that already imply the occupation. */
  atomic: string[];
  /** Loosely adjacent qualifiers — a good, not strong, match. */
  related: string[];
  /** True when the qualifier is a tool/technology, so a skill can evidence it. */
  techQualifier: boolean;
};

export type OccupationRequirement = {
  specificity: "specific" | "generic" | "none";
  specs: OccupationSpec[];
  /** Head-family words accepted for a generic query ("designers in Delhi"). */
  heads: string[];
};

export type OccupationMatch = { tier: OccupationTier; hits: string[] };

/** Interchangeable head nouns. Each list is one family. */
const HEAD_FAMILIES: string[][] = [
  ["designer", "design", "designing"],
  ["developer", "development", "engineer", "engineering", "programmer", "coder", "sde", "dev"],
  ["manager", "management"],
  ["analyst", "analytics", "analysis"],
  ["architect", "architecture"],
  ["recruiter", "recruitment", "recruiting", "sourcer"],
  ["merchandiser", "merchandising", "merchandise"],
  ["stylist", "styling"],
  ["accountant", "accounting", "accounts"],
  ["consultant", "consulting"],
  ["writer", "copywriter", "writing"],
  ["marketer", "marketing"],
  ["tester", "testing", "qa"],
  ["scientist", "science"],
  ["executive", "associate", "officer", "assistant", "specialist", "coordinator"],
  ["lead", "leader", "head", "director"],
  ["technician", "operator"],
  ["planner", "planning"],
  ["buyer", "buying"],
  ["teacher", "tutor", "trainer"],
  ["nurse", "nursing"],
  ["chef", "cook"],
  ["administrator", "admin"],
  ["supervisor"],
];

/**
 * Domain qualifier groups. Members of one group mean the same occupation domain;
 * `related` members are adjacent domains worth showing, but ranked lower.
 */
const DOMAINS: { id: string; qualifiers: string[]; related?: string[] }[] = [
  {
    id: "fashion",
    qualifiers: [
      "fashion", "apparel", "clothing", "garment", "garments", "womenswear", "menswear", "kidswear",
      "childrenswear", "knitwear", "couture", "ethnic", "ethnicwear", "bridal", "denim", "footwear",
      "lingerie", "sportswear", "athleisure",
    ],
    related: ["textile", "textiles", "fabric", "surface", "embroidery", "print", "accessory", "accessories", "leather"],
  },
  { id: "graphic", qualifiers: ["graphic", "visual", "brand", "branding", "layout", "packaging"] },
  { id: "ux", qualifiers: ["ux", "ui", "uiux", "uxui", "interaction", "usability", "experience"], related: ["product"] },
  { id: "interior", qualifiers: ["interior", "space", "furniture"], related: ["architectural"] },
  { id: "industrial", qualifiers: ["industrial", "mechanical", "automotive"] },
  { id: "jewellery", qualifiers: ["jewellery", "jewelry", "gems", "gemstone"] },
  { id: "motion", qualifiers: ["motion", "animation", "3d", "vfx"] },
  { id: "web", qualifiers: ["web", "website", "frontend", "front-end", "fullstack", "full-stack"] },
];

/** Qualifiers that are technologies: a listed skill is valid role evidence. */
const TECH_QUALIFIERS = new Set([
  "react", "reactjs", "angular", "vue", "node", "nodejs", "next", "nextjs", "java", "javascript",
  "typescript", "python", "django", "php", "laravel", "ruby", "rails", "dotnet", ".net", "c#", "c++",
  "golang", "go", "rust", "kotlin", "swift", "android", "ios", "flutter", "react-native", "mern",
  "mean", "spring", "aws", "azure", "devops", "salesforce", "sap", "power", "tableau", "excel",
  "figma", "autocad", "solidworks", "photoshop", "illustrator",
]);

const norm = (s: string | null | undefined) =>
  ` ${(s ?? "").toLowerCase().replace(/[^a-z0-9+#./ -]+/g, " ").replace(/\s+/g, " ").trim()} `;

const singular = (w: string) => (w.endsWith("s") && w.length > 3 && !w.endsWith("ss") ? w.slice(0, -1) : w);

function headFamily(word: string): string[] | null {
  const w = singular(word);
  for (const fam of HEAD_FAMILIES) if (fam.includes(w) || fam.includes(word)) return fam;
  return null;
}

function domainFor(qualifier: string): { qualifiers: string[]; related: string[] } {
  const q = singular(qualifier);
  for (const d of DOMAINS) {
    if (d.qualifiers.includes(q) || d.qualifiers.includes(qualifier)) {
      return { qualifiers: d.qualifiers, related: d.related ?? [] };
    }
  }
  return { qualifiers: [qualifier, q], related: [] };
}

/**
 * Build the occupation requirement from the plan's role phrases. Multi-word
 * phrases become atomic specific requirements; a lone head noun only ever makes
 * the requirement generic.
 */
export function occupationRequirement(roles: string[]): OccupationRequirement {
  const specs: OccupationSpec[] = [];
  const heads = new Set<string>();
  let sawHead = false;

  for (const raw of roles) {
    const words = norm(raw).trim().split(" ").filter(Boolean);
    if (!words.length) continue;
    const last = words[words.length - 1]!;
    const fam = headFamily(last);
    if (!fam) continue;
    sawHead = true;
    fam.forEach((h) => heads.add(h));

    const qualifierWords = words.slice(0, -1).filter((w) => w.length >= 2);
    if (!qualifierWords.length) continue;

    const qualifier = qualifierWords[qualifierWords.length - 1]!;
    const domain = domainFor(qualifier);
    const qualifiers = Array.from(new Set([...qualifierWords, ...domain.qualifiers]));
    const atomic = Array.from(
      new Set([
        norm(raw).trim(),
        ...domain.qualifiers.flatMap((q) => fam.map((h) => `${q} ${h}`)),
        ...domain.qualifiers.map((q) => `${q}wear`),
      ]),
    );
    specs.push({
      phrase: norm(raw).trim(),
      heads: fam,
      qualifiers,
      atomic,
      related: domain.related,
      techQualifier: qualifierWords.some((w) => TECH_QUALIFIERS.has(w)),
    });
  }

  // Collapse duplicate specs coming from AI synonyms of the same domain.
  const uniq: OccupationSpec[] = [];
  for (const s of specs) {
    if (uniq.some((u) => u.heads === s.heads && u.qualifiers.some((q) => s.qualifiers.includes(q)))) continue;
    uniq.push(s);
  }

  return {
    specificity: uniq.length ? "specific" : sawHead ? "generic" : "none",
    specs: uniq,
    heads: Array.from(heads),
  };
}

const hasWord = (text: string, word: string) =>
  new RegExp(`(?:^| )${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:s|es)?(?: |$)`).test(text);

/** qualifier within two words of the head, in either direction. */
function adjacent(text: string, qualifiers: string[], heads: string[]): string | null {
  for (const q of qualifiers) {
    const qe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    for (const h of heads) {
      const fwd = new RegExp(`\\b${qe}\\w*(?:\\s+\\w+){0,2}\\s+${h}\\w*\\b`);
      const rev = new RegExp(`\\b${h}\\w*\\s+(?:\\w+\\s+)?${qe}\\w*\\b`);
      if (fwd.test(text) || rev.test(text)) return `${q} ${h}`;
    }
  }
  return null;
}

export type RoleSignal = {
  /** Extracted role / current title — the strongest evidence. */
  role: string | null | undefined;
  skills?: (string | null | undefined)[] | null;
  /** Email + resume text, used only as fallback evidence. */
  text?: string;
};

/**
 * Decide how well a candidate's actual occupation satisfies the requirement.
 * Skills, location and years are never consulted here except when the query's
 * qualifier is itself a technology.
 */
export function matchOccupation(req: OccupationRequirement, signal: RoleSignal): OccupationMatch {
  if (req.specificity === "none") return { tier: "open", hits: [] };

  const roleText = norm(signal.role);
  const bodyText = norm(signal.text);
  const skillText = norm((signal.skills ?? []).filter(Boolean).join(" "));
  const hits: string[] = [];

  if (req.specificity === "specific") {
    for (const spec of req.specs) {
      // 1. The full occupation phrase (or a domain variant) in the title field.
      const atomicHit = spec.atomic.find((p) => roleText.includes(` ${p} `) || roleText.includes(`${p} `) || roleText.trim() === p);
      if (atomicHit) return { tier: "specific", hits: [atomicHit] };

      const roleHasHead = spec.heads.some((h) => hasWord(roleText, h));

      // 2. Qualifier and head together inside the title, e.g. "designer - apparel".
      const inRole = adjacent(roleText, spec.qualifiers, spec.heads);
      if (inRole) return { tier: "specific", hits: [inRole] };

      // 3. Technology qualifier: a Frontend Engineer who clearly works in React.
      if (spec.techQualifier && roleHasHead) {
        const techHit = spec.qualifiers.find((q) => hasWord(skillText, q) || hasWord(roleText, q) || hasWord(bodyText, q));
        if (techHit) return { tier: "specific", hits: [`${techHit} ${spec.heads[0]}`] };
      }

      // 4. Resume / email text says the occupation even though the title field is
      //    empty or vague. Requires the qualifier next to the head — never alone.
      const inText = adjacent(bodyText, spec.qualifiers, spec.heads);
      const atomicInText = spec.atomic.find((p) => bodyText.includes(` ${p} `));
      if ((inText || atomicInText) && !conflicting(spec, roleText)) {
        return { tier: "specific", hits: [(inText ?? atomicInText)!] };
      }

      // 5. Adjacent domain (textile designer for a fashion designer query).
      if (spec.related.length) {
        const rel = adjacent(roleText, spec.related, spec.heads) ?? adjacent(bodyText, spec.related, spec.heads);
        if (rel) return { tier: "related", hits: [rel] };
      }

      if (roleHasHead) hits.push(spec.heads[0]!);
    }
    // Only the generic head noun was found: not the requested occupation.
    return hits.length ? { tier: "generic", hits: [] } : { tier: "none", hits: [] };
  }

  // Generic query ("designers in Delhi"): any role in the head family counts.
  const inRole = req.heads.find((h) => hasWord(roleText, h));
  if (inRole) return { tier: "generic", hits: [inRole] };
  const inText = req.heads.find((h) => hasWord(bodyText, h));
  if (inText) return { tier: "generic", hits: [inText] };
  return { tier: "none", hits: [] };
}

/**
 * The title field names a different domain in the same head family
 * (Graphic Designer vs Fashion Designer): stray body text must not override it.
 */
function conflicting(spec: OccupationSpec, roleText: string): boolean {
  if (!spec.heads.some((h) => hasWord(roleText, h))) return false;
  if (spec.qualifiers.some((q) => hasWord(roleText, q))) return false;
  for (const d of DOMAINS) {
    if (d.qualifiers.some((q) => spec.qualifiers.includes(q))) continue;
    if (d.qualifiers.some((q) => hasWord(roleText, q))) return true;
  }
  return false;
}
