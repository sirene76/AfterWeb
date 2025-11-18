import AdminGuard from "@/components/AdminGuard";
import { fetchAdminData } from "@/lib/admin-api";

type UserAggregate = {
  _id: string;
  roles: string[];
};

export default async function UsersPage() {
  const data = await fetchAdminData<UserAggregate[]>("/api/admin/users");

  return (
    <AdminGuard>
      <h1 className="mb-6 text-2xl font-bold">Users</h1>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="text-gray-400">
            <th className="pb-2">Email</th>
            <th className="pb-2">Roles</th>
          </tr>
        </thead>
        <tbody>
          {data.map((user) => (
            <tr key={user._id} className="border-b border-gray-800">
              <td className="py-3 font-medium">{user._id}</td>
              <td className="py-3 text-gray-300">{user.roles.join(", ")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </AdminGuard>
  );
}
