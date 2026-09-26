"use client";

import { LocationsProvider } from "@/components/providers/LocationsProvider";
import { UnitsProvider } from "@/components/providers/UnitsProvider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <UnitsProvider>
      <LocationsProvider>{children}</LocationsProvider>
    </UnitsProvider>
  );
}
