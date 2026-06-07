"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Org = {
  id: number;
  name: string;
  domain: string | null;
  phone: string | null;
  plan: string;
  employee_count: number | null;
  min_threshold: number;
  created_at: string;
  admin_count: number;
  manager_count: number;
  token_count: number;
  response_count: number;
};

type Totals = {
  organizations: number;
  paid: number;
  trial: number;
  admins: number;
  responses: number;
  employees: number;
};

export default function OwnerDashboard() {
  const router = useRouter();
  const [data, setData] = useState<{ totals: Totals; organizations: Org[] } | null>(
    null
  );

  async function load() {
    const r = await fetch("/api/owner/stats");
    if (r.status === 401) {
      router.replace("/owner/login");
      return;
    }
    setData(await r.json());
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function logout() {
    await fetch("/api/owner/login", { method: "DELETE" });
    router.replace("/owner/login");
  }

  if (!data) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="mono text-xs opacity-50">Loading...</p>
      </main>
    );
  }

  const t = data.totals;

  return (
    <main className="min-h-screen">
      <header className="px-6 md:px-8 py-6 flex justify-between items-center border-b border-mist">
        <div className="serif text-xl">
          Anonvey <span className="text-clay">/ Owner</span>
        </div>
        <button onClick={logout} className="mono text-xs opacity-50 hover:opacity-100">
          Sign out
        </button>
      </header>

      <div className="max-w-6xl mx-auto px-6 md:px-8 py-10 md:py-12">
        <p className="mono text-xs uppercase tracking-widest text-clay mb-4">
          Platform operations
        </p>
        <h1 className="serif text-4xl md:text-5xl mb-3">Overview</h1>
        <p className="opacity-60 text-sm mb-10 max-w-xl">
          Operational metadata only. By design, this view cannot read any
          survey answer or comment — only counts.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-14">
          <Stat label="Organisations" value={t.organizations} />
          <Stat label="Admins" value={t.admins} />
          <Stat label="Responses" value={t.responses} />
          <Stat label="Employees" value={t.employees} />
        </div>

        <h2 className="serif text-2xl mb-6">Registered organisations</h2>
        {data.organizations.length === 0 ? (
          <p className="opacity-60 text-sm">No organisations yet.</p>
        ) : (
          <div className="overflow-x-auto border border-mist">
            <table className="w-full text-sm border-collapse min-w-[760px]">
              <thead>
                <tr className="border-b border-mist text-left">
                  {["Organisation", "Domain", "Headcount", "Managers", "Codes", "Responses", "Joined"].map(
                    (h) => (
                      <th
                        key={h}
                        className="mono text-[10px] uppercase tracking-widest opacity-60 font-normal px-4 py-3 whitespace-nowrap"
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {data.organizations.map((o) => (
                  <tr key={o.id} className="border-b border-mist last:border-0">
                    <td className="px-4 py-3">
                      <div className="serif text-base">{o.name}</div>
                      {o.phone && (
                        <div className="mono text-[10px] opacity-50">{o.phone}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 mono text-xs opacity-70">{o.domain || "—"}</td>
                    <td className="px-4 py-3">{o.employee_count ?? "—"}</td>
                    <td className="px-4 py-3">{o.manager_count}</td>
                    <td className="px-4 py-3">{o.token_count}</td>
                    <td className="px-4 py-3">{o.response_count}</td>
                    <td className="px-4 py-3 mono text-xs opacity-60 whitespace-nowrap">
                      {new Date(o.created_at).toISOString().slice(0, 10)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-mist p-4">
      <p className="mono text-[10px] uppercase tracking-widest opacity-60 mb-1">
        {label}
      </p>
      <p className="serif text-4xl">{value}</p>
    </div>
  );
}
