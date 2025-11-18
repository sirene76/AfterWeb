import AdminGuard from "@/components/AdminGuard";
import { fetchAdminData } from "@/lib/admin-api";

type Membership = {
  _id: string;
  accountId: string | { toString(): string } | null;
  userEmail: string;
  role: string;
};

function formatId(value: Membership["accountId"]): string {
  if (!value) {
    return "—";
  }
  return typeof value === "string" ? value : value.toString();
}

export default async function MembershipsPage() {
  const memberships = await fetchAdminData<Membership[]>("/api/admin/memberships");

  return (
    <AdminGuard>
      <h1 className="mb-6 text-2xl font-bold">Memberships</h1>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="text-gray-400">
            <th className="pb-2">Workspace ID</th>
            <th className="pb-2">User Email</th>
            <th className="pb-2">Role</th>
          </tr>
        </thead>
        <tbody>
          {memberships.map((membership) => (
            <tr key={membership._id} className="border-b border-gray-800">
              <td className="py-3 font-mono text-xs text-gray-400">{formatId(membership.accountId)}</td>
              <td className="py-3 font-medium">{membership.userEmail}</td>
              <td className="py-3 capitalize text-gray-300">{membership.role}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </AdminGuard>
  );
}
