import AdminGuard from "@/components/AdminGuard";
import { fetchAdminData } from "@/lib/admin-api";

type LogEntry = {
  _id: string;
  event: string;
  status: string;
  message: string;
  accountId?: string | { toString(): string } | null;
  websiteId?: string | { toString(): string } | null;
  createdAt: string;
};

function formatId(value?: string | { toString(): string } | null): string {
  if (!value) {
    return "—";
  }
  return typeof value === "string" ? value : value.toString();
}

export default async function LogsPage() {
  const logs = await fetchAdminData<LogEntry[]>("/api/admin/logs");

  return (
    <AdminGuard>
      <h1 className="mb-6 text-2xl font-bold">Operational Logs</h1>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] text-left text-sm">
          <thead>
            <tr className="text-gray-400">
              <th className="pb-2">Event</th>
              <th className="pb-2">Status</th>
              <th className="pb-2">Message</th>
              <th className="pb-2">Workspace</th>
              <th className="pb-2">Website</th>
              <th className="pb-2">Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log._id} className="border-b border-gray-800">
                <td className="py-3 font-medium capitalize">{log.event}</td>
                <td className="py-3 capitalize text-gray-300">{log.status}</td>
                <td className="py-3 text-gray-200">{log.message}</td>
                <td className="py-3 font-mono text-xs text-gray-500">{formatId(log.accountId)}</td>
                <td className="py-3 font-mono text-xs text-gray-500">{formatId(log.websiteId)}</td>
                <td className="py-3 text-gray-400">
                  {log.createdAt ? new Date(log.createdAt).toLocaleString() : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminGuard>
  );
}
