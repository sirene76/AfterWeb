"use client";

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";

interface AppSessionProviderProps {
  children: ReactNode;
}

export function AppSessionProvider({ children }: AppSessionProviderProps) {
  return <SessionProvider>{children}</SessionProvider>;
}
