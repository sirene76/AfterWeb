import AdminGuard from "@/components/AdminGuard";
import { fetchAdminData } from "@/lib/admin-api";

type Website = {
  _id: string;
  plan: "basic" | "standard" | "pro";
  billingStatus: "inactive" | "active" | "past_due" | "canceled";
};

type CountRecord = Record<string, number>;

function summarizePlans(websites: Website[]) {
  const planCounts: CountRecord = { basic: 0, standard: 0, pro: 0 };
  const statusCounts: CountRecord = { past_due: 0, canceled: 0 };

  for (const site of websites) {
    planCounts[site.plan] = (planCounts[site.plan] ?? 0) + 1;
    if (site.billingStatus === "past_due") {
      statusCounts.past_due += 1;
    } else if (site.billingStatus === "canceled") {
      statusCounts.canceled += 1;
    }
  }

  return { planCounts, statusCounts };
}

export default async function BillingPage() {
  const websites = await fetchAdminData<Website[]>("/api/admin/websites");
  const { planCounts, statusCounts } = summarizePlans(websites);

  const planLabels: Record<string, string> = {
    basic: "Free / Basic",
    standard: "Standard",
    pro: "Pro",
  };

  return (
    <AdminGuard>
      <h1 className="mb-6 text-2xl font-bold">Billing & Plans</h1>
      <div className="grid gap-6 md:grid-cols-3">
        {Object.entries(planCounts).map(([plan, count]) => (
          <div key={plan} className="rounded border border-gray-800 bg-gray-900 p-5">
            <p className="text-sm uppercase tracking-wide text-gray-400">{planLabels[plan]}</p>
            <p className="mt-2 text-3xl font-semibold">{count}</p>
            <p className="text-xs text-gray-500">Sites on this plan</p>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <div className="rounded border border-gray-800 bg-gray-900 p-5">
          <p className="text-sm uppercase tracking-wide text-gray-400">Past Due Accounts</p>
          <p className="mt-2 text-3xl font-semibold">{statusCounts.past_due}</p>
          <p className="text-xs text-gray-500">Require billing follow-up</p>
        </div>
        <div className="rounded border border-gray-800 bg-gray-900 p-5">
          <p className="text-sm uppercase tracking-wide text-gray-400">Canceled Accounts</p>
          <p className="mt-2 text-3xl font-semibold">{statusCounts.canceled}</p>
          <p className="text-xs text-gray-500">Subscriptions canceled</p>
        </div>
      </div>
    </AdminGuard>
  );
}
