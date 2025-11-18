import AdminGuard from "@/components/AdminGuard";
import { fetchAdminData } from "@/lib/admin-api";

type Workspace = {
  _id: string;
  name: string;
  type: string;
  ownerEmail: string;
  createdAt: string;
};

export default async function WorkspacesPage() {
  const workspaces = await fetchAdminData<Workspace[]>("/api/admin/workspaces");

  return (
    <AdminGuard>
      <h1 className="mb-6 text-2xl font-bold">Workspaces</h1>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="text-gray-400">
            <th className="pb-2">Name</th>
            <th className="pb-2">Type</th>
            <th className="pb-2">Owner</th>
            <th className="pb-2">Created</th>
          </tr>
        </thead>
        <tbody>
          {workspaces.map((workspace) => (
            <tr key={workspace._id} className="border-b border-gray-800">
              <td className="py-3 font-medium">{workspace.name}</td>
              <td className="py-3">{workspace.type}</td>
              <td className="py-3 text-gray-300">{workspace.ownerEmail}</td>
              <td className="py-3 text-gray-400">
                {workspace.createdAt ? new Date(workspace.createdAt).toLocaleString() : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </AdminGuard>
  );
}
