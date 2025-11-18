import Link from "next/link";
import { ReactNode } from "react";

export const metadata = {
  title: "Admin Console — AfterWeb",
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-gray-950 text-white">
      <aside className="w-64 border-r border-gray-800 p-6">
        <h1 className="mb-6 text-xl font-bold">AfterWeb Admin</h1>
        <nav className="flex flex-col gap-3">
          <Link href="/admin/users" className="hover:text-blue-400">
            Users
          </Link>
          <Link href="/admin/workspaces" className="hover:text-blue-400">
            Workspaces
          </Link>
          <Link href="/admin/memberships" className="hover:text-blue-400">
            Memberships
          </Link>
          <Link href="/admin/websites" className="hover:text-blue-400">
            Websites
          </Link>
          <Link href="/admin/billing" className="hover:text-blue-400">
            Billing
          </Link>
          <Link href="/admin/logs" className="hover:text-blue-400">
            Logs
          </Link>
        </nav>
      </aside>

      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
