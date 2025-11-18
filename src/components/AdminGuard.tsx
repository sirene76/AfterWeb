import { ReactNode } from "react";

import { requireAdmin } from "@/lib/admin";

export default async function AdminGuard({ children }: { children: ReactNode }) {
  await requireAdmin();
  return <>{children}</>;
}
