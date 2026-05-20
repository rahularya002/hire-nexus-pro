export type TaskState = "Pending" | "Ongoing" | "Interview Pending" | "Closed" | "Reopened" | "No-show";
export type TaskKind =
  | "Call candidate"
  | "Confirm interview"
  | "Share shortlist"
  | "Follow up with client"
  | "Schedule interview round"
  | "Collect feedback";

export interface OpsTask {
  id: string;
  kind: TaskKind;
  title: string;
  candidate?: string;
  client?: string;
  position?: string;
  due: string;
  state: TaskState;
  sla?: "warning" | "breach" | "ok";
  recruiterId: string;
}

export const opsTasks: OpsTask[] = [
  { id: "t1", kind: "Call candidate", title: "Call Arjun Malhotra — confirm Friday slot", candidate: "Arjun Malhotra", client: "Razorpay", position: "Sr. Product Designer", due: "Today 4:30 PM", state: "Pending", sla: "warning", recruiterId: "r1" },
  { id: "t2", kind: "Confirm interview", title: "Confirm Sneha's R3 with Tata Digital", candidate: "Sneha Kulkarni", client: "Tata Digital", position: "Engineering Manager", due: "Today 6:00 PM", state: "Interview Pending", sla: "ok", recruiterId: "r1" },
  { id: "t3", kind: "Share shortlist", title: "Share 4 shortlisted profiles with Rolex India", client: "Rolex India", position: "Boutique Manager", due: "Tomorrow", state: "Ongoing", sla: "ok", recruiterId: "r1" },
  { id: "t4", kind: "Follow up with client", title: "Follow up with Reliance Brands on E-com Head feedback", client: "Reliance Brands", position: "Head of E-commerce", due: "Overdue · 1d", state: "Pending", sla: "breach", recruiterId: "r2" },
  { id: "t5", kind: "Schedule interview round", title: "Schedule R2 for Karan Verma", candidate: "Karan Verma", client: "Razorpay", position: "Full Stack Engineer", due: "Today", state: "Ongoing", sla: "ok", recruiterId: "r2" },
  { id: "t6", kind: "Collect feedback", title: "Collect HR feedback for Ishita Banerjee", candidate: "Ishita Banerjee", client: "Reliance Brands", position: "Data Scientist", due: "Today", state: "Interview Pending", sla: "warning", recruiterId: "r3" },
  { id: "t7", kind: "Call candidate", title: "Reach out to Devansh — no-show on R1", candidate: "Devansh Singh", client: "Tata Digital", position: "DevOps Engineer", due: "Yesterday", state: "No-show", sla: "breach", recruiterId: "r3" },
  { id: "t8", kind: "Share shortlist", title: "Share Boutique Manager longlist with Rolex India", client: "Rolex India", position: "Boutique Manager — Mumbai", due: "Last week", state: "Closed", sla: "ok", recruiterId: "r1" },
  { id: "t9", kind: "Collect feedback", title: "Reopen feedback loop with Razorpay design lead", client: "Razorpay", position: "Sr. Product Designer", due: "Today", state: "Reopened", sla: "warning", recruiterId: "r2" },
];

export type RecruiterStatus = "Available" | "Active" | "Break" | "Offline";

export interface Recruiter {
  id: string;
  name: string;
  initials: string;
  role: string;
  status: RecruiterStatus;
  loginAt: string;
  assignedClients: number;
  assignedPositions: number;
  sharesToday: number;
  closuresMtd: number;
  conversionPct: number;
  joinedOn: string;
}

export const recruiters: Recruiter[] = [
  { id: "r1", name: "Aarav Reddy", initials: "AR", role: "Senior Recruiter", status: "Active", loginAt: "08:42 AM", assignedClients: 4, assignedPositions: 11, sharesToday: 9, closuresMtd: 5, conversionPct: 18, joinedOn: "Mar 2022" },
  { id: "r2", name: "Priya Iyer", initials: "PI", role: "Recruiter", status: "Available", loginAt: "09:05 AM", assignedClients: 3, assignedPositions: 8, sharesToday: 6, closuresMtd: 3, conversionPct: 14, joinedOn: "Aug 2023" },
  { id: "r3", name: "Rohan Kapoor", initials: "RK", role: "Recruiter", status: "Break", loginAt: "09:18 AM", assignedClients: 2, assignedPositions: 5, sharesToday: 2, closuresMtd: 1, conversionPct: 9, joinedOn: "Jan 2024" },
  { id: "r4", name: "Neha Sharma", initials: "NS", role: "Lead Recruiter", status: "Active", loginAt: "08:30 AM", assignedClients: 5, assignedPositions: 14, sharesToday: 12, closuresMtd: 7, conversionPct: 22, joinedOn: "Jun 2021" },
  { id: "r5", name: "Vikram Shah", initials: "VS", role: "Recruiter", status: "Offline", loginAt: "—", assignedClients: 2, assignedPositions: 6, sharesToday: 0, closuresMtd: 2, conversionPct: 11, joinedOn: "Nov 2023" },
];

// ----- Roster reactivity (mock store with subscribe/notify) -----
let rosterVersion = 0;
const rosterListeners = new Set<() => void>();
export function subscribeRoster(cb: () => void) {
  rosterListeners.add(cb);
  return () => { rosterListeners.delete(cb); };
}
export function getRosterVersion() { return rosterVersion; }
export function setRecruiterStatus(id: string, status: RecruiterStatus) {
  const r = recruiters.find((x) => x.id === id);
  if (!r || r.status === status) return;
  r.status = status;
  rosterVersion++;
  rosterListeners.forEach((l) => l());
}

export interface CommItem {
  id: string;
  candidate: string;
  channel: "WhatsApp" | "Email" | "Call";
  state: "Sent" | "Awaiting response" | "Confirmed" | "Follow-up pending";
  when: string;
}

export const pendingConfirmations: CommItem[] = [
  { id: "cm1", candidate: "Arjun Malhotra", channel: "WhatsApp", state: "Awaiting response", when: "1h ago" },
  { id: "cm2", candidate: "Karan Verma", channel: "Call", state: "Follow-up pending", when: "3h ago" },
  { id: "cm3", candidate: "Tanya Agarwal", channel: "Email", state: "Awaiting response", when: "Yesterday" },
  { id: "cm4", candidate: "Meera Krishnan", channel: "WhatsApp", state: "Confirmed", when: "20m ago" },
];

export const slaWarnings = [
  { id: "sla1", title: "Reliance Brands — Head of E-commerce", detail: "No update in 4 days · Client SLA = 3d", severity: "breach" as const },
  { id: "sla2", title: "Rolex India — Watchmaker", detail: "Interview feedback pending · 36h", severity: "warning" as const },
  { id: "sla3", title: "Razorpay — Sr. Product Designer", detail: "Offer rollout overdue · 1d", severity: "warning" as const },
];

export const dailyDigest = {
  shares: { value: 14, delta: "+3 vs yesterday" },
  interviews: { value: 4, delta: "1 no-show" },
  offers: { value: 2, delta: "1 accepted" },
  closures: { value: 1, delta: "₹14L revenue" },
};

export function tasksByState(state: TaskState) {
  return opsTasks.filter((t) => t.state === state);
}

/* ----- Candidate detail (drilldown) ----- */

export interface CandidateDetail {
  id: string;
  name: string;
  initials: string;
  experience: string;
  salary: string;
  prevOrg: string;
  location: string;
  noticePeriod: string;
  aiMatch: number;
  resumeSummary: string;
  source: string;
  history: string[];
  comms: { channel: "WhatsApp" | "Email" | "Call"; state: string; when: string }[];
}

export const candidateDetails: Record<string, CandidateDetail> = {
  default: {
    id: "default",
    name: "Candidate",
    initials: "C",
    experience: "—",
    salary: "—",
    prevOrg: "—",
    location: "—",
    noticePeriod: "—",
    aiMatch: 0,
    resumeSummary: "Resume preview not available.",
    source: "Internal DB",
    history: [],
    comms: [],
  },
};

export function detailFor(c: { id: string; name: string; initials: string; experience: string; location: string; matchScore: number }): CandidateDetail {
  // Deterministic synthetic detail from base candidate fields.
  const orgs = ["Tata Digital", "Reliance Brands", "Razorpay", "Zomato", "Tanishq", "Tag Heuer India", "Titan", "Flipkart"];
  const salaries = ["₹18 LPA", "₹26 LPA", "₹34 LPA", "₹42 LPA", "₹55 LPA", "₹68 LPA"];
  const notices = ["Immediate", "15 days", "30 days", "60 days", "90 days"];
  const seed = c.id.length + c.name.length;
  return {
    id: c.id,
    name: c.name,
    initials: c.initials,
    experience: c.experience,
    salary: salaries[seed % salaries.length],
    prevOrg: orgs[seed % orgs.length],
    location: c.location,
    noticePeriod: notices[seed % notices.length],
    aiMatch: c.matchScore,
    resumeSummary:
      `${c.experience} of experience leading cross-functional teams. Currently at ${orgs[seed % orgs.length]}. Strong fit on the top 3 must-have competencies for this role.`,
    source: seed % 2 === 0 ? "AI Talent Scout" : "Internal database",
    history: [
      "Sourced via AI Scout · 4d ago",
      "AI matched · 92% relevance",
      "Recruiter shortlisted by Aarav · 3d ago",
      "Shared with client · 2d ago",
    ],
    comms: [
      { channel: "WhatsApp", state: "Sent", when: "2h ago" },
      { channel: "Email", state: "Awaiting response", when: "Yesterday" },
      { channel: "Call", state: "Completed", when: "2d ago" },
    ],
  };
}

/* ----- Interview orchestration ----- */

export type RoundKind = "HR Screen" | "Technical" | "Hiring Manager" | "Panel" | "CEO" | "Culture Fit" | "Case Study";
export type RoundStatus = "Pending confirmation" | "Confirmed" | "Reschedule requested" | "Completed" | "No-show";
export type MeetingProvider = "Google Meet" | "Microsoft Teams" | "Zoom" | "On-site";

export interface InterviewRound {
  id: string;
  index: number;
  kind: RoundKind;
  interviewer: string;
  scheduledFor: string;
  status: RoundStatus;
  provider: MeetingProvider;
  meetingLink?: string;
  cvAttached: boolean;
  recruiterReminder: boolean;
  candidateReminder: boolean;
  notes?: string;
}

export interface InterviewProcess {
  id: string;
  candidate: string;
  candidateInitials: string;
  position: string;
  client: string;
  clientId: string;
  rounds: InterviewRound[];
}

export const interviewProcesses: InterviewProcess[] = [
  {
    id: "ip1",
    candidate: "Arjun Malhotra",
    candidateInitials: "AM",
    position: "Sr. Product Designer",
    client: "Razorpay",
    clientId: "razorpay",
    rounds: [
      { id: "ip1-r1", index: 1, kind: "HR Screen", interviewer: "Pooja N. (HR)", scheduledFor: "Mon · 10:00 AM", status: "Completed", provider: "Google Meet", meetingLink: "meet.google.com/abc-defg-hij", cvAttached: true, recruiterReminder: true, candidateReminder: true, notes: "Strong communication, good culture fit." },
      { id: "ip1-r2", index: 2, kind: "Technical", interviewer: "Rahul B. (Design Lead)", scheduledFor: "Wed · 4:30 PM", status: "Confirmed", provider: "Google Meet", meetingLink: "meet.google.com/xyz-1234-pqr", cvAttached: true, recruiterReminder: true, candidateReminder: true },
      { id: "ip1-r3", index: 3, kind: "Hiring Manager", interviewer: "Aditya R. (VP Design)", scheduledFor: "Fri · 11:00 AM", status: "Pending confirmation", provider: "Google Meet", cvAttached: true, recruiterReminder: true, candidateReminder: false },
      { id: "ip1-r4", index: 4, kind: "CEO", interviewer: "Harshil M. (CEO)", scheduledFor: "Next Mon · TBD", status: "Pending confirmation", provider: "Zoom", cvAttached: false, recruiterReminder: false, candidateReminder: false },
    ],
  },
  {
    id: "ip2",
    candidate: "Sneha Kulkarni",
    candidateInitials: "SK",
    position: "Engineering Manager",
    client: "Tata Digital",
    clientId: "tata-digital",
    rounds: [
      { id: "ip2-r1", index: 1, kind: "HR Screen", interviewer: "Anjali P. (HR)", scheduledFor: "Last Tue · 11:00 AM", status: "Completed", provider: "Microsoft Teams", cvAttached: true, recruiterReminder: true, candidateReminder: true, notes: "Cleared HR." },
      { id: "ip2-r2", index: 2, kind: "Technical", interviewer: "Karan S. (Principal Eng)", scheduledFor: "Thu · 2:00 PM", status: "Reschedule requested", provider: "Microsoft Teams", meetingLink: "teams.microsoft.com/l/meet/abc", cvAttached: true, recruiterReminder: true, candidateReminder: true, notes: "Candidate requested reschedule due to conflict." },
      { id: "ip2-r3", index: 3, kind: "Hiring Manager", interviewer: "Rohan K. (Director Eng)", scheduledFor: "TBD", status: "Pending confirmation", provider: "Microsoft Teams", cvAttached: true, recruiterReminder: false, candidateReminder: false },
    ],
  },
  {
    id: "ip3",
    candidate: "Ishita Banerjee",
    candidateInitials: "IB",
    position: "Data Scientist",
    client: "Reliance Brands",
    clientId: "reliance-brands",
    rounds: [
      { id: "ip3-r1", index: 1, kind: "Technical", interviewer: "Vivek L. (Sr. DS)", scheduledFor: "Today · 3:30 PM", status: "Confirmed", provider: "Zoom", meetingLink: "zoom.us/j/9876543210", cvAttached: true, recruiterReminder: true, candidateReminder: true },
      { id: "ip3-r2", index: 2, kind: "Case Study", interviewer: "Take-home · 48h", scheduledFor: "After R1", status: "Pending confirmation", provider: "On-site", cvAttached: false, recruiterReminder: false, candidateReminder: false },
      { id: "ip3-r3", index: 3, kind: "Hiring Manager", interviewer: "Vikram S. (Head of DS)", scheduledFor: "TBD", status: "Pending confirmation", provider: "Zoom", cvAttached: false, recruiterReminder: false, candidateReminder: false },
    ],
  },
  {
    id: "ip4",
    candidate: "Devansh Singh",
    candidateInitials: "DS",
    position: "DevOps Engineer",
    client: "Tata Digital",
    clientId: "tata-digital",
    rounds: [
      { id: "ip4-r1", index: 1, kind: "HR Screen", interviewer: "Anjali P. (HR)", scheduledFor: "Yesterday · 11:00 AM", status: "No-show", provider: "Microsoft Teams", cvAttached: true, recruiterReminder: true, candidateReminder: true, notes: "Candidate did not join. Follow-up scheduled." },
    ],
  },
];

export function getInterviewProcess(id: string) {
  return interviewProcesses.find((p) => p.id === id);
}

/* ----- Recruiter activity feed ----- */

export type ActivityKind =
  | "call"
  | "shortlist"
  | "share"
  | "interview_scheduled"
  | "interview_completed"
  | "offer"
  | "closure"
  | "note";

export interface ActivityEvent {
  id: string;
  recruiterId: string;
  kind: ActivityKind;
  title: string;
  detail: string;
  client?: string;
  position?: string;
  candidate?: string;
  when: string;          // human display
  occurredAt: number;    // ms since epoch (for sorting)
}

const now = Date.now();
const min = 60_000;
const hr = 60 * min;
const day = 24 * hr;

export const activityFeed: ActivityEvent[] = [
  // Aarav (r1) — high activity
  { id: "ae1", recruiterId: "r1", kind: "share",               title: "Shared 4 profiles with Rolex India",       detail: "Boutique Manager — flagship Mumbai", client: "Rolex India",     position: "Boutique Manager",     when: "12m ago", occurredAt: now - 12 * min },
  { id: "ae2", recruiterId: "r1", kind: "call",                title: "Call · Arjun Malhotra",                    detail: "Confirmed Friday R3 slot", client: "Razorpay",        position: "Sr. Product Designer", candidate: "Arjun Malhotra", when: "1h ago",  occurredAt: now - 1 * hr },
  { id: "ae3", recruiterId: "r1", kind: "interview_scheduled", title: "Interview scheduled · Sneha Kulkarni",     detail: "R3 — Hiring Manager · Tata Digital",  client: "Tata Digital",    position: "Engineering Manager",  candidate: "Sneha Kulkarni", when: "3h ago",  occurredAt: now - 3 * hr },
  { id: "ae4", recruiterId: "r1", kind: "shortlist",           title: "Shortlisted 6 candidates internally",      detail: "Rolex India · Boutique Manager",  client: "Rolex India",     position: "Boutique Manager",     when: "Yesterday", occurredAt: now - 1 * day },
  { id: "ae5", recruiterId: "r1", kind: "closure",             title: "Closed · Meera Krishnan",                  detail: "City Head — Zomato · ₹14L revenue", client: "Zomato",         position: "City Head",             candidate: "Meera Krishnan", when: "2d ago", occurredAt: now - 2 * day },

  // Priya (r2)
  { id: "ae6", recruiterId: "r2", kind: "share",   title: "Shared 3 profiles with Reliance Brands",   detail: "Head of E-commerce",                  client: "Reliance Brands", position: "Head of E-commerce",   when: "40m ago", occurredAt: now - 40 * min },
  { id: "ae7", recruiterId: "r2", kind: "interview_completed", title: "Interview complete · Karan Verma", detail: "R2 — System Design (Razorpay)",   client: "Razorpay",        position: "Full Stack Engineer",  candidate: "Karan Verma",    when: "5h ago", occurredAt: now - 5 * hr },
  { id: "ae8", recruiterId: "r2", kind: "note",    title: "Note added on Tanya Agarwal",              detail: "Awaiting client feedback · day 2",     client: "Reliance Brands", position: "Finance Controller",   candidate: "Tanya Agarwal",  when: "Yesterday", occurredAt: now - 1 * day },
  { id: "ae9", recruiterId: "r2", kind: "offer",   title: "Offer rolled out · Devansh Singh",         detail: "DevOps · Tata Digital",                client: "Tata Digital",    position: "DevOps Engineer",      candidate: "Devansh Singh",  when: "2d ago", occurredAt: now - 2 * day },

  // Rohan (r3) — lighter
  { id: "ae10", recruiterId: "r3", kind: "call",      title: "Call · Devansh Singh",       detail: "Follow-up after no-show",                client: "Tata Digital",    position: "DevOps Engineer",      candidate: "Devansh Singh", when: "2h ago",  occurredAt: now - 2 * hr },
  { id: "ae11", recruiterId: "r3", kind: "shortlist", title: "Added 2 candidates to longlist", detail: "Razorpay · Sr. Product Designer",     client: "Razorpay",        position: "Sr. Product Designer",                              when: "Yesterday", occurredAt: now - 1 * day },

  // Neha (r4) — lead recruiter, highest volume
  { id: "ae12", recruiterId: "r4", kind: "closure",  title: "Closed · Boutique Manager — Delhi", detail: "Rolex India · ₹26L revenue",       client: "Rolex India",     position: "Boutique Manager",                                  when: "4h ago", occurredAt: now - 4 * hr },
  { id: "ae13", recruiterId: "r4", kind: "share",    title: "Shared 7 profiles · Reliance Brands", detail: "Visual Merchandiser",            client: "Reliance Brands", position: "Visual Merchandiser",                              when: "6h ago", occurredAt: now - 6 * hr },
  { id: "ae14", recruiterId: "r4", kind: "interview_scheduled", title: "Interview scheduled · Ishita Banerjee", detail: "R2 — Case Study · Reliance Brands", client: "Reliance Brands", position: "Data Scientist", candidate: "Ishita Banerjee", when: "Yesterday", occurredAt: now - 1 * day },

  // Vikram (r5) — offline / minimal
  { id: "ae15", recruiterId: "r5", kind: "note",  title: "Handover notes added", detail: "Razorpay design pipeline · Q3 plan", client: "Razorpay", position: "Sr. Product Designer", when: "2d ago", occurredAt: now - 2 * day },
];

export function activityForRecruiter(id: string) {
  return activityFeed.filter((a) => a.recruiterId === id).sort((a, b) => b.occurredAt - a.occurredAt);
}
export function allActivity() {
  return [...activityFeed].sort((a, b) => b.occurredAt - a.occurredAt);
}
export function activitySummary(id?: string) {
  const list = id ? activityForRecruiter(id) : activityFeed;
  const todayCut = Date.now() - 1 * day;
  const todayList = list.filter((a) => a.occurredAt >= todayCut);
  const count = (kinds: ActivityKind[], src = todayList) =>
    src.filter((a) => kinds.includes(a.kind)).length;
  return {
    shares: count(["share"]),
    interviews: count(["interview_scheduled", "interview_completed"]),
    offers: count(["offer"]),
    closures: count(["closure"]),
    calls: count(["call"]),
  };
}