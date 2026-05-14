export type ClientPositionStatus = "open" | "in_progress" | "interviews" | "closed";

export interface SharedCandidate {
  id: string;
  name: string;
  initials: string;
  role: string;
  experience: string;
  location: string;
  currentCompany: string;
  expectedCtc: string;
  noticePeriod: string;
  matchScore: number;
  status: "pending" | "shortlisted" | "rejected" | "interview";
  summary: string;
  skills: string[];
}

export interface ClientPosition {
  id: string;
  title: string;
  location: string;
  experience: string;
  salary: string;
  openings: number;
  status: ClientPositionStatus;
  postedDays: number;
  description: string;
  skills: string[];
  candidates: SharedCandidate[];
  interviewSlots?: { id: string; date: string; time: string; panel: string; mode: string }[];
  documents?: { name: string; required: boolean; received: boolean }[];
  sentDaysAgo?: number;
  recruiterId?: string;
  funnel?: { sourced: number; shared: number; shortlisted: number; interview: number; offered: number; joined: number };
}

export const clientCompany = {
  name: "Reliance Brands",
  tagline: "Premium & luxury retail portfolio",
  contact: "Vikram Shah · Head of Talent",
  initials: "RB",
  color: "oklch(0.62 0.20 295)",
};

export type ProgressStep = "received" | "sourcing" | "shared" | "review" | "interview" | "offer";
export const PROGRESS_STEPS: { id: ProgressStep; label: string }[] = [
  { id: "received",  label: "Received" },
  { id: "sourcing",  label: "Sourcing" },
  { id: "shared",    label: "Profiles shared" },
  { id: "review",    label: "Client review" },
  { id: "interview", label: "Interviews" },
  { id: "offer",     label: "Offer / Joined" },
];

export function currentStep(p: ClientPosition): ProgressStep {
  if (p.status === "closed") return "offer";
  const f = p.funnel;
  if (!f) return "received";
  if (f.offered > 0 || f.joined > 0) return "offer";
  if (f.interview > 0) return "interview";
  if (f.shortlisted > 0) return "review";
  if (f.shared > 0) return "shared";
  if (f.sourced > 0) return "sourcing";
  return "received";
}

export interface AccountRecruiter {
  id: string;
  name: string;
  initials: string;
  role: string;
  email: string;
  phone: string;
  responseHrs: number;
  ownedRequirementIds: string[];
}

export const accountTeam: AccountRecruiter[] = [
  { id: "r1", name: "Aarav Reddy",   initials: "AR", role: "Account Lead · Senior Recruiter", email: "aarav@talentflow.in",  phone: "+91 98112 04411", responseHrs: 1.4, ownedRequirementIds: ["cp-1", "cp-3"] },
  { id: "r2", name: "Priya Iyer",    initials: "PI", role: "Recruiter · Retail & Luxury",     email: "priya@talentflow.in",  phone: "+91 98112 38221", responseHrs: 2.1, ownedRequirementIds: ["cp-2"] },
  { id: "r3", name: "Devansh Singh", initials: "DS", role: "Sourcer · Tech & Product",        email: "devansh@talentflow.in",phone: "+91 98203 71190", responseHrs: 0.8, ownedRequirementIds: ["cp-4"] },
];

export function recruiterFor(id?: string) {
  return accountTeam.find((r) => r.id === id) ?? accountTeam[0];
}

export interface ActivityEvent {
  id: string;
  type: "submission" | "shortlist" | "interview" | "offer" | "document" | "message" | "closed";
  title: string;
  detail: string;
  timeAgo: string;
  unread?: boolean;
  positionId?: string;
}

export const activityEvents: ActivityEvent[] = [
  { id: "ae1", type: "submission", title: "3 new profiles shared",                detail: "Head of E-commerce · Aarav Reddy",                timeAgo: "12 min ago", unread: true, positionId: "cp-1" },
  { id: "ae2", type: "interview",  title: "Interview slot proposed",              detail: "Sneha Kulkarni · May 16, 3:00 PM (BKC)",          timeAgo: "1 hr ago",   unread: true, positionId: "cp-1" },
  { id: "ae3", type: "shortlist",  title: "Candidate moved to Shortlist",         detail: "Arjun Malhotra · Head of E-commerce",             timeAgo: "3 hrs ago",  unread: true, positionId: "cp-1" },
  { id: "ae4", type: "document",   title: "Document received from candidate",     detail: "Background Check Consent · Arjun Malhotra",       timeAgo: "Yesterday",                positionId: "cp-1" },
  { id: "ae5", type: "message",    title: "Recruiter sent a message",             detail: "Priya Iyer · Visual Merchandiser",                timeAgo: "Yesterday",                positionId: "cp-2" },
  { id: "ae6", type: "offer",      title: "Offer rolled out",                     detail: "Meera Krishnan · Buyer — Womenswear",             timeAgo: "2 days ago",               positionId: "cp-4" },
  { id: "ae7", type: "closed",     title: "Requirement closed",                   detail: "Buyer — Womenswear · 2 hires",                    timeAgo: "3 days ago",               positionId: "cp-4" },
  { id: "ae8", type: "submission", title: "5 profiles shared",                    detail: "Boutique Manager · Aarav Reddy",                  timeAgo: "4 days ago",               positionId: "cp-3" },
];

export interface Placement {
  id: string;
  candidateName: string;
  initials: string;
  positionTitle: string;
  positionId: string;
  ctc: string;
  offerDate: string;
  joiningDate: string;
  guaranteeDays: number;
  guaranteeWindow: number;
  invoiceStatus: "draft" | "sent" | "paid";
}

export const placements: Placement[] = [
  { id: "pl1", candidateName: "Meera Krishnan", initials: "MK", positionTitle: "Buyer — Womenswear",      positionId: "cp-4", ctc: "₹26 LPA", offerDate: "Mar 28, 2026", joiningDate: "Apr 15, 2026", guaranteeDays: 29,  guaranteeWindow: 90, invoiceStatus: "paid" },
  { id: "pl2", candidateName: "Anish Kapoor",   initials: "AK", positionTitle: "Buyer — Womenswear",      positionId: "cp-4", ctc: "₹24 LPA", offerDate: "Apr 02, 2026", joiningDate: "Apr 22, 2026", guaranteeDays: 22,  guaranteeWindow: 90, invoiceStatus: "sent" },
  { id: "pl3", candidateName: "Tara Bhatt",     initials: "TB", positionTitle: "Visual Merchandiser",     positionId: "cp-2", ctc: "₹15 LPA", offerDate: "Feb 11, 2026", joiningDate: "Mar 03, 2026", guaranteeDays: 72,  guaranteeWindow: 90, invoiceStatus: "paid" },
  { id: "pl4", candidateName: "Rohan Joshi",    initials: "RJ", positionTitle: "Store Manager — Phoenix", positionId: "cp-3", ctc: "₹19 LPA", offerDate: "Dec 14, 2025", joiningDate: "Jan 12, 2026", guaranteeDays: 122, guaranteeWindow: 90, invoiceStatus: "paid" },
];

export interface ClientMessage {
  id: string;
  from: "client" | "recruiter";
  authorName: string;
  initials: string;
  body: string;
  timeAgo: string;
}

export const messageThreads: Record<string, ClientMessage[]> = {
  "cp-1": [
    { id: "m1", from: "recruiter", authorName: "Aarav Reddy", initials: "AR", body: "Sharing 3 fresh profiles for Head of E-commerce. Arjun is the strongest fit — happy to set up a chat this week.", timeAgo: "2 hrs ago" },
    { id: "m2", from: "client",    authorName: "Vikram Shah", initials: "VS", body: "Thanks. Can we get Sneha in for the CEO round on May 17?", timeAgo: "1 hr ago" },
    { id: "m3", from: "recruiter", authorName: "Aarav Reddy", initials: "AR", body: "On it — confirming with her panel and will revert by EOD.", timeAgo: "45 min ago" },
  ],
  "cp-2": [
    { id: "m4", from: "recruiter", authorName: "Priya Iyer", initials: "PI", body: "South India shortlist coming today. Have 4 strong VM profiles from luxury & premium retail.", timeAgo: "Yesterday" },
  ],
};

export const monthlyHires = [
  { month: "Dec", hires: 1 },
  { month: "Jan", hires: 1 },
  { month: "Feb", hires: 1 },
  { month: "Mar", hires: 1 },
  { month: "Apr", hires: 2 },
  { month: "May", hires: 0 },
];

export const sourceMix = [
  { source: "LinkedIn",         pct: 38 },
  { source: "Internal database", pct: 27 },
  { source: "Naukri",           pct: 18 },
  { source: "Referrals",        pct: 12 },
  { source: "Other",            pct: 5 },
];

export function aggregateFunnel() {
  const acc = { sourced: 0, shared: 0, shortlisted: 0, interview: 0, offered: 0, joined: 0 };
  for (const p of clientPositions) {
    if (!p.funnel) continue;
    acc.sourced     += p.funnel.sourced;
    acc.shared      += p.funnel.shared;
    acc.shortlisted += p.funnel.shortlisted;
    acc.interview   += p.funnel.interview;
    acc.offered     += p.funnel.offered;
    acc.joined      += p.funnel.joined;
  }
  return acc;
}

const candidates: SharedCandidate[] = [
  {
    id: "sc1", name: "Arjun Malhotra", initials: "AM", role: "Senior Product Designer",
    experience: "7 yrs", location: "Bengaluru", currentCompany: "Swiggy",
    expectedCtc: "₹42 LPA", noticePeriod: "30 days", matchScore: 94,
    status: "shortlisted",
    summary: "Led design for Swiggy Instamart's checkout. Strong systems thinking & B2C consumer experience.",
    skills: ["Product Design", "Design Systems", "Figma", "Research"],
  },
  {
    id: "sc2", name: "Sneha Kulkarni", initials: "SK", role: "Sr. Engineering Manager",
    experience: "10 yrs", location: "Mumbai", currentCompany: "PhonePe",
    expectedCtc: "₹68 LPA", noticePeriod: "60 days", matchScore: 91,
    status: "interview",
    summary: "Scaled PhonePe merchant platform to 30M+ businesses. Hands-on engineering leader.",
    skills: ["Java", "Distributed Systems", "Team Building", "Architecture"],
  },
  {
    id: "sc3", name: "Karan Verma", initials: "KV", role: "Full Stack Engineer",
    experience: "5 yrs", location: "Pune", currentCompany: "Razorpay",
    expectedCtc: "₹32 LPA", noticePeriod: "45 days", matchScore: 88,
    status: "pending",
    summary: "Full-stack engineer with deep React + Node experience. Built Razorpay's dashboard rewrite.",
    skills: ["React", "Node.js", "TypeScript", "PostgreSQL"],
  },
  {
    id: "sc4", name: "Ishita Banerjee", initials: "IB", role: "Brand Marketing Lead",
    experience: "8 yrs", location: "Mumbai", currentCompany: "Nykaa",
    expectedCtc: "₹38 LPA", noticePeriod: "30 days", matchScore: 86,
    status: "pending",
    summary: "Built Nykaa Luxe's brand campaigns. Strong luxury & beauty category expertise.",
    skills: ["Brand Strategy", "Campaign Mgmt", "Luxury", "Storytelling"],
  },
  {
    id: "sc5", name: "Rahul Pillai", initials: "RP", role: "Retail Operations",
    experience: "9 yrs", location: "Delhi NCR", currentCompany: "Tata CLiQ Luxury",
    expectedCtc: "₹35 LPA", noticePeriod: "60 days", matchScore: 79,
    status: "rejected",
    summary: "Drove North India operations across 40+ luxury stores.",
    skills: ["Retail Ops", "P&L", "Store Mgmt"],
  },
];

export const clientPositions: ClientPosition[] = [
  {
    id: "cp-1",
    title: "Head of E-commerce",
    location: "Mumbai",
    experience: "10-15 yrs",
    salary: "₹55-75 LPA",
    openings: 1,
    status: "in_progress",
    postedDays: 2,
    sentDaysAgo: 2,
    recruiterId: "r1",
    funnel: { sourced: 24, shared: 6, shortlisted: 3, interview: 2, offered: 0, joined: 0 },
    description: "Own the omnichannel commerce P&L across 60+ premium brands. Drive D2C growth, marketplace strategy and customer experience.",
    skills: ["D2C", "Marketplace", "P&L", "Digital Marketing", "Leadership"],
    candidates: candidates.slice(0, 4),
    interviewSlots: [
      { id: "s1", date: "May 15", time: "10:00 AM", panel: "Vikram Shah + Anita Desai", mode: "Google Meet" },
      { id: "s2", date: "May 16", time: "3:00 PM", panel: "Vikram Shah + Rohit Bal", mode: "On-site, BKC" },
      { id: "s3", date: "May 17", time: "11:30 AM", panel: "CEO Round", mode: "On-site, BKC" },
    ],
    documents: [
      { name: "Updated Resume", required: true, received: true },
      { name: "Last 3 Payslips", required: true, received: true },
      { name: "Offer Letter (Current)", required: true, received: false },
      { name: "Educational Certificates", required: true, received: false },
      { name: "Background Check Consent", required: true, received: true },
    ],
  },
  {
    id: "cp-2",
    title: "Visual Merchandiser",
    location: "Bengaluru",
    experience: "4-7 yrs",
    salary: "₹12-18 LPA",
    openings: 3,
    status: "interviews",
    postedDays: 6,
    sentDaysAgo: 6,
    recruiterId: "r2",
    funnel: { sourced: 41, shared: 9, shortlisted: 5, interview: 3, offered: 1, joined: 0 },
    description: "Design seasonal in-store experiences across South India stores.",
    skills: ["Window Displays", "Brand Storytelling", "Adobe Suite"],
    candidates: candidates.slice(1, 4),
  },
  {
    id: "cp-3",
    title: "Boutique Manager — Bandra Flagship",
    location: "Mumbai",
    experience: "8-12 yrs",
    salary: "₹28-38 LPA",
    openings: 1,
    status: "open",
    postedDays: 1,
    sentDaysAgo: 1,
    recruiterId: "r1",
    funnel: { sourced: 12, shared: 0, shortlisted: 0, interview: 0, offered: 0, joined: 0 },
    description: "Lead the Bandra flagship team and drive luxury clientele experience.",
    skills: ["Luxury Retail", "Team Leadership", "CRM", "VIP"],
    candidates: candidates.slice(2, 5),
  },
  {
    id: "cp-4",
    title: "Buyer — Womenswear",
    location: "Mumbai",
    experience: "6-9 yrs",
    salary: "₹22-30 LPA",
    openings: 2,
    status: "closed",
    postedDays: 28,
    sentDaysAgo: 28,
    recruiterId: "r3",
    funnel: { sourced: 36, shared: 11, shortlisted: 6, interview: 4, offered: 2, joined: 2 },
    description: "Curate womenswear collections across premium brands.",
    skills: ["Buying", "Merchandising", "Fashion"],
    candidates: candidates.slice(0, 2),
  },
];

export function getClientPosition(id: string) {
  return clientPositions.find((p) => p.id === id);
}