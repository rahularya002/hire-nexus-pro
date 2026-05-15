import { useSyncExternalStore } from "react";
import {
  recruiters,
  subscribeRoster,
  getRosterVersion,
  setRecruiterStatus,
  type Recruiter,
  type RecruiterStatus,
} from "./store";

// ----- Permissions catalog -----
export const ALL_PERMISSIONS = [
  { key: "candidates.view", label: "View candidates", group: "Candidates" },
  { key: "candidates.edit", label: "Edit candidates", group: "Candidates" },
  { key: "candidates.delete", label: "Delete candidates", group: "Candidates" },
  { key: "positions.view", label: "View positions", group: "Positions" },
  { key: "positions.create", label: "Create positions", group: "Positions" },
  { key: "positions.assign", label: "Assign recruiters", group: "Positions" },
  { key: "clients.view", label: "View clients", group: "Clients" },
  { key: "clients.manage", label: "Manage clients", group: "Clients" },
  { key: "pipeline.share", label: "Share to client", group: "Pipeline" },
  { key: "pipeline.move", label: "Move stages", group: "Pipeline" },
  { key: "team.view", label: "View team", group: "Team" },
  { key: "team.invite", label: "Invite recruiters", group: "Team" },
  { key: "roles.manage", label: "Manage roles & permissions", group: "Admin" },
  { key: "billing.manage", label: "Manage billing", group: "Admin" },
] as const;

export type PermKey = (typeof ALL_PERMISSIONS)[number]["key"];
export type Role = { id: string; name: string; description: string; system: boolean; permissions: PermKey[] };

export const DEFAULT_ROLES: Role[] = [
  { id: "admin", name: "Admin", description: "Full access to everything.", system: true, permissions: ALL_PERMISSIONS.map((p) => p.key) },
  { id: "lead", name: "Lead Recruiter", description: "Leads a desk; manages positions, pipeline and team.", system: true, permissions: ["candidates.view","candidates.edit","positions.view","positions.create","positions.assign","clients.view","clients.manage","pipeline.share","pipeline.move","team.view","team.invite"] },
  { id: "senior", name: "Senior Recruiter", description: "Owns positions and shares to clients.", system: true, permissions: ["candidates.view","candidates.edit","positions.view","positions.create","clients.view","pipeline.share","pipeline.move","team.view"] },
  { id: "recruiter", name: "Recruiter", description: "Standard recruiter access.", system: true, permissions: ["candidates.view","candidates.edit","positions.view","clients.view","pipeline.move","team.view"] },
];

// ----- Current recruiter (mock impersonation) -----
let currentRecruiterId = "r1";
const sessionListeners = new Set<() => void>();

export function getCurrentRecruiterId() { return currentRecruiterId; }
export function setCurrentRecruiter(id: string) {
  if (!recruiters.some((r) => r.id === id) || id === currentRecruiterId) return;
  currentRecruiterId = id;
  sessionListeners.forEach((l) => l());
}

function subscribeAccess(cb: () => void) {
  const off1 = subscribeRoster(cb);
  sessionListeners.add(cb);
  return () => { off1(); sessionListeners.delete(cb); };
}

function snapshot() {
  // Composite version: bumps on roster status changes OR impersonation changes.
  return `${getRosterVersion()}:${currentRecruiterId}`;
}

function useAccessVersion() {
  return useSyncExternalStore(subscribeAccess, snapshot, snapshot);
}

export function useCurrentRecruiter(): Recruiter {
  useAccessVersion();
  return recruiters.find((r) => r.id === currentRecruiterId) ?? recruiters[0];
}

export function useMyRole(): Role {
  const me = useCurrentRecruiter();
  return DEFAULT_ROLES.find((r) => r.name === me.role) ?? DEFAULT_ROLES[DEFAULT_ROLES.length - 1];
}

export function useCan(): (p: PermKey) => boolean {
  const role = useMyRole();
  return (p: PermKey) => role.permissions.includes(p);
}

export function setMyStatus(s: RecruiterStatus) {
  setRecruiterStatus(currentRecruiterId, s);
}

export function useRoster(): Recruiter[] {
  useAccessVersion();
  return recruiters;
}