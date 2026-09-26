"use client";

import { DashboardProvider } from "@/components/providers/DashboardProvider";
import { AppShell } from "@/components/shell/AppShell";

export default function Page() {
  return (
    <DashboardProvider>
      <AppShell />
    </DashboardProvider>
  );
}
