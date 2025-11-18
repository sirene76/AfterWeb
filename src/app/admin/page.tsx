import AdminGuard from "@/components/AdminGuard";

export default async function AdminHomePage() {
  return (
    <AdminGuard>
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">Admin Console</h1>
        <p className="text-gray-300">
          Welcome to the AfterWeb Admin Console. Use the navigation to review
          users, workspaces, websites, billing signals, and operational logs.
        </p>
      </div>
    </AdminGuard>
  );
}
