import {
  Database,
  Linkedin,
  Github,
  Briefcase,
  Globe,
  Users,
  type LucideIcon,
} from "lucide-react";

export type ScoutSourceId =
  | "internal"
  | "linkedin"
  | "github"
  | "naukri"
  | "iimjobs"
  | "hirist"
  | "instahyre"
  | "angellist"
  | "cutshort"
  | "referrals";

export type ScoutSource = {
  id: ScoutSourceId;
  label: string;
  icon: LucideIcon;
  hint: string;
  /** True when we have an actor / integration wired for this channel. */
  hasActor: boolean;
  /** Default Apify actor slug (when hasActor). */
  defaultActorSlug?: string;
  /** Rough cost estimate per 1000 profiles, for the admin view. */
  costPer1k?: string;
};

export const SCOUT_SOURCES: ScoutSource[] = [
  { id: "internal",  label: "Internal database", icon: Database,  hint: "Your existing candidate pool", hasActor: true },
  { id: "linkedin",  label: "LinkedIn",          icon: Linkedin,  hint: "Apify LinkedIn profile search",        hasActor: true,  defaultActorSlug: "harvestapi~linkedin-profile-search", costPer1k: "~$2" },
  { id: "github",    label: "GitHub",            icon: Github,    hint: "GitHub public API — free, no actor",    hasActor: true,  costPer1k: "free" },
  { id: "naukri",    label: "Naukri",            icon: Briefcase, hint: "Apify Naukri scraper (add NAUKRI_COOKIE for emails/phones)", hasActor: true, defaultActorSlug: "jupri~naukri-scraper", costPer1k: "~$3" },
  { id: "iimjobs",   label: "iimjobs",           icon: Briefcase, hint: "No actor wired yet",                    hasActor: false },
  { id: "hirist",    label: "Hirist",            icon: Briefcase, hint: "No actor wired yet",                    hasActor: false },
  { id: "instahyre", label: "Instahyre",         icon: Briefcase, hint: "No actor wired yet",                    hasActor: false },
  { id: "cutshort",  label: "Cutshort",          icon: Briefcase, hint: "No actor wired yet",                    hasActor: false },
  { id: "angellist", label: "Wellfound",         icon: Globe,     hint: "No actor wired yet",                    hasActor: false },
  { id: "referrals", label: "Referrals",         icon: Users,     hint: "No actor wired yet",                    hasActor: false },
];

export function getScoutSource(id: string): ScoutSource | undefined {
  return SCOUT_SOURCES.find((s) => s.id === id);
}