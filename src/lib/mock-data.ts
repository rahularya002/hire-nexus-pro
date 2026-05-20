export type Priority = "high" | "medium" | "low";
export type PositionStatus = "open" | "in_progress" | "interviews" | "closed";
export type CandidateStage =
  | "Sourcing"
  | "Recruiter Shortlist"
  | "Shared with Client"
  | "Client Shortlist"
  | "Interview Scheduled"
  | "Rounds"
  | "Offered"
  | "Closed";

export const PIPELINE_STAGES: CandidateStage[] = [
  "Sourcing",
  "Recruiter Shortlist",
  "Shared with Client",
  "Client Shortlist",
  "Interview Scheduled",
  "Rounds",
  "Offered",
  "Closed",
];

export interface Client {
  id: string;
  name: string;
  industry: string;
  contact: string;
  openPositions: number;
  activeCandidates: number;
  initials: string;
  color: string;
  lastActivityDays: number;
  // Extended account health metrics (admin-only views)
  lastMandateDays: number;       // days since last mandate received
  lastClosureDays: number;       // days since last position closure
  spoc: { name: string; email: string; phone: string };
  positionsClosedYTD: number;
  revenueYTDInr: number;         // INR
}

export interface Position {
  id: string;
  clientId: string;
  title: string;
  location: string;
  experience: string;
  salary: string;
  openings: number;
  priority: Priority;
  status: PositionStatus;
  postedDays: number;
  skills: string[];
  description: string;
  candidates: Candidate[];
}

export interface Candidate {
  id: string;
  name: string;
  role: string;
  experience: string;
  location: string;
  matchScore: number;
  stage: CandidateStage;
  initials: string;
  email: string;
}

export const clients: Client[] = [
  { id: "rolex-india", name: "Rolex India", industry: "Luxury Retail", contact: "Aanya Mehta", openPositions: 6, activeCandidates: 28, initials: "RX", color: "oklch(0.55 0.20 255)", lastActivityDays: 1,
    lastMandateDays: 8, lastClosureDays: 22, spoc: { name: "Aanya Mehta", email: "aanya.mehta@rolex.in",   phone: "+91 98201 11122" }, positionsClosedYTD: 9,  revenueYTDInr: 86_00_000 },
  { id: "reliance-brands", name: "Reliance Brands", industry: "Retail Conglomerate", contact: "Vikram Shah", openPositions: 11, activeCandidates: 47, initials: "RB", color: "oklch(0.62 0.20 295)", lastActivityDays: 0,
    lastMandateDays: 2, lastClosureDays: 14, spoc: { name: "Vikram Shah", email: "vikram.shah@rb.in",      phone: "+91 99300 45577" }, positionsClosedYTD: 18, revenueYTDInr: 2_15_00_000 },
  { id: "urban-works", name: "Urban Works", industry: "Co-working & Real Estate", contact: "Priya Iyer", openPositions: 0, activeCandidates: 4, initials: "UW", color: "oklch(0.65 0.18 230)", lastActivityDays: 75,
    lastMandateDays: 75, lastClosureDays: 110, spoc: { name: "Priya Iyer", email: "priya@urbanworks.in",    phone: "+91 98765 21234" }, positionsClosedYTD: 3,  revenueYTDInr: 12_50_000 },
  { id: "tata-digital", name: "Tata Digital", industry: "Technology", contact: "Rohan Kapoor", openPositions: 8, activeCandidates: 35, initials: "TD", color: "oklch(0.65 0.18 150)", lastActivityDays: 2,
    lastMandateDays: 5, lastClosureDays: 30, spoc: { name: "Rohan Kapoor", email: "rohan.k@tatadigital.com", phone: "+91 90040 33345" }, positionsClosedYTD: 14, revenueYTDInr: 1_42_00_000 },
  { id: "zomato", name: "Zomato", industry: "Food Tech", contact: "Neha Sharma", openPositions: 0, activeCandidates: 0, initials: "Z", color: "oklch(0.60 0.22 27)", lastActivityDays: 95,
    lastMandateDays: 95, lastClosureDays: 140, spoc: { name: "Neha Sharma", email: "neha.sharma@zomato.com", phone: "+91 97119 88865" }, positionsClosedYTD: 1,  revenueYTDInr: 6_00_000 },
  { id: "razorpay", name: "Razorpay", industry: "Fintech", contact: "Aditya Rao", openPositions: 7, activeCandidates: 31, initials: "RP", color: "oklch(0.55 0.20 255)", lastActivityDays: 0,
    lastMandateDays: 1, lastClosureDays: 9, spoc: { name: "Aditya Rao", email: "aditya.rao@razorpay.com",   phone: "+91 88791 02234" }, positionsClosedYTD: 11, revenueYTDInr: 1_05_00_000 },
];

export const INACTIVITY_MANDATE_DAYS = 60;
export const INACTIVITY_CLOSURE_DAYS = 90;
/** Legacy export kept for any UI still referencing it. */
export const INACTIVITY_THRESHOLD_DAYS = INACTIVITY_MANDATE_DAYS;

export function isClientInactive(c: Client) {
  return c.lastMandateDays > INACTIVITY_MANDATE_DAYS || c.lastClosureDays > INACTIVITY_CLOSURE_DAYS;
}

const candidatePool: Omit<Candidate, "stage">[] = [
  { id: "c1", name: "Arjun Malhotra", role: "Senior Product Designer", experience: "7 yrs", location: "Bengaluru", matchScore: 94, initials: "AM", email: "arjun.m@mail.com" },
  { id: "c2", name: "Sneha Kulkarni", role: "Engineering Manager", experience: "10 yrs", location: "Mumbai", matchScore: 91, initials: "SK", email: "sneha.k@mail.com" },
  { id: "c3", name: "Karan Verma", role: "Full Stack Engineer", experience: "5 yrs", location: "Pune", matchScore: 88, initials: "KV", email: "karan.v@mail.com" },
  { id: "c4", name: "Ishita Banerjee", role: "Data Scientist", experience: "6 yrs", location: "Hyderabad", matchScore: 86, initials: "IB", email: "ishita.b@mail.com" },
  { id: "c5", name: "Rahul Pillai", role: "Brand Marketing Lead", experience: "8 yrs", location: "Delhi NCR", matchScore: 83, initials: "RP", email: "rahul.p@mail.com" },
  { id: "c6", name: "Meera Krishnan", role: "Retail Operations Head", experience: "12 yrs", location: "Chennai", matchScore: 79, initials: "MK", email: "meera.k@mail.com" },
  { id: "c7", name: "Devansh Singh", role: "DevOps Engineer", experience: "4 yrs", location: "Bengaluru", matchScore: 77, initials: "DS", email: "devansh.s@mail.com" },
  { id: "c8", name: "Tanya Agarwal", role: "Finance Controller", experience: "9 yrs", location: "Mumbai", matchScore: 74, initials: "TA", email: "tanya.a@mail.com" },
];

function makeCandidates(seed: number): Candidate[] {
  return candidatePool.slice(0, 6 + (seed % 3)).map((c, i) => ({
    ...c,
    id: `${c.id}-${seed}`,
    stage: PIPELINE_STAGES[(i + seed) % (PIPELINE_STAGES.length - 1)],
  }));
}

export const positions: Position[] = [
  {
    id: "pos-1", clientId: "rolex-india",
    title: "Boutique Manager — Flagship Mumbai",
    location: "Mumbai", experience: "8-12 yrs", salary: "₹28-38 LPA",
    openings: 2, priority: "high", status: "in_progress", postedDays: 4,
    skills: ["Luxury Retail", "Team Leadership", "CRM", "VIP Clientele"],
    description: "Lead the flagship boutique team, drive sales targets and elevate the in-store experience for HNI clientele.",
    candidates: makeCandidates(1),
  },
  {
    id: "pos-2", clientId: "rolex-india",
    title: "Watchmaker — Service Centre",
    location: "Delhi NCR", experience: "5-9 yrs", salary: "₹14-20 LPA",
    openings: 1, priority: "medium", status: "interviews", postedDays: 11,
    skills: ["Mechanical Watches", "Precision Tools", "WOSTEP"],
    description: "Service and restore high-precision Swiss timepieces for the regional service centre.",
    candidates: makeCandidates(2),
  },
  {
    id: "pos-3", clientId: "reliance-brands",
    title: "Head of E-commerce",
    location: "Mumbai", experience: "10-15 yrs", salary: "₹55-75 LPA",
    openings: 1, priority: "high", status: "in_progress", postedDays: 2,
    skills: ["D2C", "Marketplace", "P&L", "Digital Marketing"],
    description: "Own the omnichannel commerce P&L across 60+ premium brands.",
    candidates: makeCandidates(3),
  },
  {
    id: "pos-4", clientId: "reliance-brands",
    title: "Visual Merchandiser",
    location: "Bengaluru", experience: "4-7 yrs", salary: "₹12-18 LPA",
    openings: 3, priority: "medium", status: "open", postedDays: 6,
    skills: ["Window Displays", "Brand Storytelling", "Adobe Suite"],
    description: "Design seasonal in-store experiences across South India stores.",
    candidates: makeCandidates(4),
  },
  {
    id: "pos-5", clientId: "urban-works",
    title: "Community Manager",
    location: "Pune", experience: "3-5 yrs", salary: "₹9-14 LPA",
    openings: 2, priority: "low", status: "open", postedDays: 9,
    skills: ["Community Building", "Events", "Member Success"],
    description: "Build and nurture the member community at Urban Works' new Pune campus.",
    candidates: makeCandidates(5),
  },
  {
    id: "pos-6", clientId: "tata-digital",
    title: "Principal Engineer — Platform",
    location: "Bengaluru", experience: "12+ yrs", salary: "₹80 LPA – ₹1.2 Cr",
    openings: 1, priority: "high", status: "interviews", postedDays: 14,
    skills: ["Distributed Systems", "Java", "Kafka", "Architecture"],
    description: "Architect the next-gen super-app platform serving 100M+ users.",
    candidates: makeCandidates(6),
  },
  {
    id: "pos-7", clientId: "razorpay",
    title: "Senior Product Designer",
    location: "Bengaluru / Remote", experience: "5-8 yrs", salary: "₹35-50 LPA",
    openings: 2, priority: "high", status: "in_progress", postedDays: 1,
    skills: ["Product Design", "Fintech", "Design Systems", "Prototyping"],
    description: "Shape the design language for Razorpay's payments and banking products.",
    candidates: makeCandidates(7),
  },
  {
    id: "pos-8", clientId: "zomato",
    title: "City Head — Operations",
    location: "Hyderabad", experience: "7-10 yrs", salary: "₹30-42 LPA",
    openings: 1, priority: "medium", status: "closed", postedDays: 32,
    skills: ["Hyperlocal Ops", "Logistics", "Team Management"],
    description: "Drive city-level growth, supply, and delivery operations.",
    candidates: makeCandidates(8),
  },
];

export function getClient(id: string) {
  return clients.find((c) => c.id === id);
}
export function getPosition(id: string) {
  return positions.find((p) => p.id === id);
}
export function positionsByClient(id: string) {
  return positions.filter((p) => p.clientId === id);
}

export const todaysInterviews = [
  { id: "i1", time: "10:30 AM", candidate: "Arjun Malhotra", position: "Sr. Product Designer", client: "Razorpay", round: "R2 — Design Critique", mode: "Google Meet" },
  { id: "i2", time: "12:00 PM", candidate: "Sneha Kulkarni", position: "Engineering Manager", client: "Tata Digital", round: "R3 — Hiring Manager", mode: "On-site" },
  { id: "i3", time: "3:30 PM", candidate: "Ishita Banerjee", position: "Data Scientist", client: "Reliance Brands", round: "R1 — Technical", mode: "Zoom" },
  { id: "i4", time: "5:00 PM", candidate: "Karan Verma", position: "Full Stack Engineer", client: "Razorpay", round: "R2 — System Design", mode: "Google Meet" },
];

export const recentActivity = [
  { id: "a1", icon: "upload", title: "New JD uploaded by Reliance Brands", detail: "Head of E-commerce · Mumbai", time: "12 min ago", tone: "info" as const },
  { id: "a2", icon: "check", title: "Candidate shortlisted by Razorpay", detail: "Arjun Malhotra · Sr. Product Designer", time: "1 hr ago", tone: "success" as const },
  { id: "a3", icon: "calendar", title: "Interview scheduled", detail: "Sneha Kulkarni — Tata Digital · Tomorrow 11 AM", time: "2 hrs ago", tone: "purple" as const },
  { id: "a4", icon: "star", title: "Offer rolled out", detail: "Meera Krishnan — Zomato (City Head)", time: "Yesterday", tone: "warning" as const },
  { id: "a5", icon: "user", title: "5 new candidates added to pipeline", detail: "Rolex India · Boutique Manager", time: "Yesterday", tone: "info" as const },
];

export const submissionTrend = [
  { day: "Mon", submissions: 12, interviews: 4 },
  { day: "Tue", submissions: 18, interviews: 6 },
  { day: "Wed", submissions: 15, interviews: 5 },
  { day: "Thu", submissions: 22, interviews: 9 },
  { day: "Fri", submissions: 28, interviews: 11 },
  { day: "Sat", submissions: 9, interviews: 3 },
  { day: "Sun", submissions: 4, interviews: 1 },
];