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
}

export const clientCompany = {
  name: "Reliance Brands",
  tagline: "Premium & luxury retail portfolio",
  contact: "Vikram Shah · Head of Talent",
  initials: "RB",
  color: "oklch(0.62 0.20 295)",
};

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
    description: "Curate womenswear collections across premium brands.",
    skills: ["Buying", "Merchandising", "Fashion"],
    candidates: candidates.slice(0, 2),
  },
];

export function getClientPosition(id: string) {
  return clientPositions.find((p) => p.id === id);
}