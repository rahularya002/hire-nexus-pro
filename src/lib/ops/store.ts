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