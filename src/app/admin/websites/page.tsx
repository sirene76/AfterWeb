import AdminGuard from "@/components/AdminGuard";
import { fetchAdminData } from "@/lib/admin-api";

type Website = {
  _id: string;
  name: string;
  plan: string;
  billingStatus: string;
  deployUrl?: string;
  accountId?: string | { toString(): string } | null;
  createdAt: string;
  status: string;
};

function formatId(value?: Website["accountId"]): string {
  if (!value) {
    return "—";
  }
  return typeof value === "string" ? value : value.toString();
}

export default async function WebsitesPage() {
  const websites = await fetchAdminData<Website[]>("/api/admin/websites");

  return (
    <AdminGuard>
      <h1 className="mb-6 text-2xl font-bold">Websites</h1>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] text-left text-sm">
          <thead>
            <tr className="text-gray-400">
              <th className="pb-2">Name</th>
              <th className="pb-2">Plan</th>
              <th className="pb-2">Billing</th>
              <th className="pb-2">Status</th>
              <th className="pb-2">Deploy URL</th>
              <th className="pb-2">Workspace</th>
              <th className="pb-2">Created</th>
            </tr>
          </thead>
          <tbody>
            {websites.map((site) => (
              <tr key={site._id} className="border-b border-gray-800">
                <td className="py-3 font-medium">{site.name}</td>
                <td className="py-3 capitalize">{site.plan}</td>
                <td className="py-3 capitalize text-gray-300">{site.billingStatus}</td>
                <td className="py-3 text-gray-300">{site.status}</td>
                <td className="py-3 text-blue-300">
                  {site.deployUrl ? (
                    <a href={site.deployUrl} target="_blank" rel="noreferrer">
                      {site.deployUrl}
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="py-3 font-mono text-xs text-gray-400">{formatId(site.accountId)}</td>
                <td className="py-3 text-gray-400">
                  {site.createdAt ? new Date(site.createdAt).toLocaleString() : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminGuard>
  );
}
