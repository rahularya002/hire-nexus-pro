import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/superadmin")({
  ssr: false,
  component: () => <Outlet />,
});