import { useEffect } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";

const AGENCY_LAST_PATH = "talentflow:agency:lastPath";
const CLIENT_SELECTED_ID = "talentflow:client:selectedId";

const isBrowser = () => typeof window !== "undefined";

export function getAgencyLastPath(): string {
  if (!isBrowser()) return "/";
  return sessionStorage.getItem(AGENCY_LAST_PATH) || "/";
}

export function setAgencyLastPath(path: string) {
  if (!isBrowser()) return;
  sessionStorage.setItem(AGENCY_LAST_PATH, path);
}

export function getSelectedClientId(): string | null {
  if (!isBrowser()) return null;
  return sessionStorage.getItem(CLIENT_SELECTED_ID);
}

export function setSelectedClientId(id: string) {
  if (!isBrowser()) return;
  sessionStorage.setItem(CLIENT_SELECTED_ID, id);
}

/** Records every agency route the user visits so we can return here from the client portal. */
export function useTrackAgencyPath() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  useEffect(() => {
    if (pathname.startsWith("/client")) return;
    setAgencyLastPath(pathname);
    // If we're on a client detail page, remember which client is "selected"
    const m = pathname.match(/^\/clients\/([^/]+)/);
    if (m) setSelectedClientId(m[1]);
  }, [pathname]);
}

/** From the client portal, navigate back to the last agency route visited. */
export function useReturnToAgency() {
  const navigate = useNavigate();
  return () => navigate({ to: getAgencyLastPath() as string });
}
