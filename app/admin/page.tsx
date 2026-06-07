"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type ManagerResult = {
  id: number;
  name: string;
  department: string | null;
  response_count: number;
  suppressed: boolean;
  avg_clarity: number | null;
  avg_support: number | null;
  avg_fairness: number | null;
  avg_growth: number | null;
};

type Culture = {
  total: number;
  suppressed: boolean;
  avg_trust: number | null;
  avg_inclusion: number | null;
  avg_workload: number | null;
  avg_voice: number | null;
};

type Results = {
  org?: { name: string; plan: string; logo: string | null };
  threshold: number;
  managers: ManagerResult[];
  culture: Culture;
  comments: { manager: string | null; culture: string | null }[];
};

type ManagerRow = {
  id: number;
  name: string;
  department: string | null;
  email: string | null;
  active: boolean;
  parent_id: number | null;
  parent_name: string | null;
};

type Employee = {
  id: number;
  name: string;
  email: string | null;
  department: string | null;
  manager_id: number | null;
  manager_name: string | null;
};

type Tab = "results" | "manage" | "employees";

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminDashboard() {
  const router = useRouter();
  const [data, setData] = useState<Results | null>(null);
  const [tab, setTab] = useState<Tab>("results");
  const [managerRows, setManagerRows] = useState<ManagerRow[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [busy, setBusy] = useState(false);

  // add manager
  const [mgrName, setMgrName] = useState("");
  const [mgrDept, setMgrDept] = useState("");
  const [mgrEmail, setMgrEmail] = useState("");
  const [mgrParent, setMgrParent] = useState("");

  // threshold
  const [thresholdInput, setThresholdInput] = useState("");
  const [thresholdSaved, setThresholdSaved] = useState(false);

  // codes
  const [tokenCount, setTokenCount] = useState(10);
  const [tokenDays, setTokenDays] = useState(30);
  const [tokenManager, setTokenManager] = useState(""); // "" = any
  const [generatedTokens, setGeneratedTokens] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  // employees
  const [empName, setEmpName] = useState("");
  const [empEmail, setEmpEmail] = useState("");
  const [empDept, setEmpDept] = useState("");
  const [empManager, setEmpManager] = useState("");
  const [importMsg, setImportMsg] = useState<{
    ok: boolean;
    errors?: string[];
    warnings?: string[];
    added?: number;
  } | null>(null);
  const [recipients, setRecipients] = useState<
    { name: string; email: string | null; token: string }[]
  >([]);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    const r = await fetch("/api/admin/results");
    if (r.status === 401) return router.replace("/admin/login");
    const d = await r.json();
    setData(d);
    if (d?.threshold != null) setThresholdInput(String(d.threshold));
  }
  async function loadManagers() {
    const r = await fetch("/api/admin/managers");
    if (r.status === 401) return router.replace("/admin/login");
    const d = await r.json();
    setManagerRows(d.managers || []);
  }
  async function loadEmployees() {
    const r = await fetch("/api/admin/employees");
    if (r.status === 401) return router.replace("/admin/login");
    const d = await r.json();
    setEmployees(d.employees || []);
  }

  useEffect(() => {
    load();
    loadManagers();
    loadEmployees();
  }, []);

  function post(body: any) {
    return fetch("/api/admin/managers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }
  function postEmp(body: any) {
    return fetch("/api/admin/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const activeManagers = managerRows.filter((m) => m.active);

  async function addManager() {
    if (!mgrName.trim()) return;
    setBusy(true);
    await post({
      action: "add_manager",
      name: mgrName,
      department: mgrDept,
      email: mgrEmail,
      parent_id: mgrParent || null,
    });
    setMgrName("");
    setMgrDept("");
    setMgrEmail("");
    setMgrParent("");
    setBusy(false);
    loadManagers();
    load();
  }

  async function toggleManager(id: number, active: boolean) {
    setBusy(true);
    await post({ action: "set_active", id, active });
    setBusy(false);
    loadManagers();
    load();
  }

  async function saveThreshold() {
    const t = parseInt(thresholdInput, 10);
    if (!Number.isInteger(t) || t < 1) return;
    setBusy(true);
    await post({ action: "set_threshold", threshold: t });
    setBusy(false);
    setThresholdSaved(true);
    setTimeout(() => setThresholdSaved(false), 2000);
    load();
  }

  async function genTokens() {
    setBusy(true);
    setCopied(false);
    const r = await post({
      action: "generate_tokens",
      count: tokenCount,
      days: tokenDays,
      manager_id: tokenManager || null,
    });
    const d = await r.json();
    if (d.ok) setGeneratedTokens(d.tokens);
    setBusy(false);
  }

  async function copyTokens() {
    const text = generatedTokens.map((t) => `${baseUrl}/respond?code=${t}`).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }

  async function addEmployee() {
    if (!empName.trim()) return;
    setBusy(true);
    await postEmp({
      action: "add_employee",
      name: empName,
      email: empEmail,
      department: empDept,
      manager_id: empManager || null,
    });
    setEmpName("");
    setEmpEmail("");
    setEmpDept("");
    setEmpManager("");
    setBusy(false);
    loadEmployees();
  }

  async function importCsv(file: File) {
    setBusy(true);
    setImportMsg(null);
    const text = await file.text();
    const r = await postEmp({ action: "import_csv", csv: text });
    const d = await r.json();
    setImportMsg(d);
    setBusy(false);
    if (fileRef.current) fileRef.current.value = "";
    if (d.ok) loadEmployees();
  }

  async function deleteEmployee(id: number) {
    setBusy(true);
    await postEmp({ action: "delete_employee", id });
    setBusy(false);
    loadEmployees();
  }

  async function genEmployeeCodes() {
    setBusy(true);
    const r = await post({ action: "generate_employee_tokens", days: tokenDays });
    const d = await r.json();
    if (d.ok) setRecipients(d.recipients);
    setBusy(false);
  }

  function downloadMerge() {
    const header = "name,email,code,link";
    const rows = recipients.map(
      (r) =>
        `${csvCell(r.name)},${csvCell(r.email || "")},${r.token},${baseUrl}/respond?code=${r.token}`
    );
    downloadText("anonvey-employee-codes.csv", [header, ...rows].join("\r\n"));
  }

  async function downloadReport() {
    const r = await fetch("/api/admin/report");
    if (!r.ok) return;
    const text = await r.text();
    downloadText("anonvey-report.csv", text);
  }

  async function logout() {
    await fetch("/api/admin/login", { method: "DELETE" });
    router.replace("/admin/login");
  }

  if (!data) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="mono text-xs opacity-50">Loading...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <header className="px-5 md:px-8 py-5 flex flex-wrap gap-y-3 justify-between items-center border-b border-mist">
        <div className="flex items-center gap-5 md:gap-6">
          <div className="flex items-center gap-3">
            <span className="serif text-lg md:text-xl">Anonvey</span>
            {data.org?.logo && (
              <>
                <span className="opacity-30">×</span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={data.org.logo}
                  alt={`${data.org.name} logo`}
                  className="h-7 w-7 object-contain"
                />
              </>
            )}
            <span className="opacity-50 serif text-lg md:text-xl">
              / {data.org?.name || "Admin"}
            </span>
            {data.org?.plan && (
              <span
                className={`mono text-[9px] uppercase tracking-widest px-2 py-0.5 ${
                  data.org.plan === "pro"
                    ? "bg-sage text-paper"
                    : "border border-mist opacity-70"
                }`}
              >
                {data.org.plan}
              </span>
            )}
          </div>
          <nav className="flex gap-4 mono text-xs uppercase tracking-widest">
            {(["results", "manage", "employees"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={tab === t ? "text-ink" : "opacity-50"}
              >
                {t}
              </button>
            ))}
          </nav>
        </div>
        <button onClick={logout} className="mono text-xs opacity-50 hover:opacity-100">
          Sign out
        </button>
      </header>

      <div className="max-w-5xl mx-auto px-5 md:px-8 py-10 md:py-12">
        {tab === "results" && (
          <>
            <div className="flex flex-wrap gap-4 justify-between items-end mb-10">
              <div>
                <p className="mono text-xs uppercase tracking-widest text-sage mb-2">
                  Minimum group size: {data.threshold}
                </p>
                <h1 className="serif text-4xl md:text-5xl">Results</h1>
              </div>
              <button className="btn-ghost btn" onClick={downloadReport}>
                Download CSV report
              </button>
            </div>

            <section className="mb-16">
              <h2 className="serif text-2xl mb-6">Organisation-wide culture</h2>
              {data.culture.suppressed ? (
                <SuppressedBox
                  message={`Need ${data.threshold - data.culture.total} more responses before culture results can be shown.`}
                />
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <Metric label="Trust" value={data.culture.avg_trust} />
                  <Metric label="Inclusion" value={data.culture.avg_inclusion} />
                  <Metric label="Workload" value={data.culture.avg_workload} />
                  <Metric label="Voice" value={data.culture.avg_voice} />
                </div>
              )}
              <p className="mono text-xs opacity-50 mt-4">
                Based on {data.culture.total} response
                {data.culture.total === 1 ? "" : "s"}.
              </p>
            </section>

            <section className="mb-16">
              <h2 className="serif text-2xl mb-6">By manager</h2>
              <div className="space-y-4">
                {data.managers.map((m) => (
                  <div key={m.id} className="border border-mist p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="serif text-xl">{m.name}</h3>
                        {m.department && (
                          <p className="mono text-xs opacity-60">{m.department}</p>
                        )}
                      </div>
                      <p className="mono text-xs opacity-60">
                        {m.response_count} response{m.response_count === 1 ? "" : "s"}
                      </p>
                    </div>
                    {m.suppressed ? (
                      <SuppressedBox
                        message={`Suppressed — need ${
                          data.threshold - m.response_count
                        } more response(s) to show ratings.`}
                      />
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Metric label="Clarity" value={m.avg_clarity} small />
                        <Metric label="Support" value={m.avg_support} small />
                        <Metric label="Fairness" value={m.avg_fairness} small />
                        <Metric label="Growth" value={m.avg_growth} small />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 className="serif text-2xl mb-6">Comments (random order)</h2>
              {data.comments.length === 0 ? (
                <p className="opacity-60 text-sm">
                  No comments to show yet, or below minimum threshold.
                </p>
              ) : (
                <div className="space-y-4">
                  {data.comments.map((c, i) => (
                    <div key={i} className="border-l-2 border-clay pl-4 py-1">
                      {c.manager && (
                        <p className="mb-1">
                          <span className="mono text-xs opacity-50 uppercase mr-2">
                            Manager
                          </span>
                          {c.manager}
                        </p>
                      )}
                      {c.culture && (
                        <p>
                          <span className="mono text-xs opacity-50 uppercase mr-2">
                            Culture
                          </span>
                          {c.culture}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {tab === "manage" && (
          <>
            <h1 className="serif text-4xl md:text-5xl mb-12">Manage</h1>

            <section className="mb-16">
              <h2 className="serif text-2xl mb-4">Anonymity threshold</h2>
              <p className="opacity-70 text-sm mb-6 max-w-md">
                The minimum number of responses before any group&apos;s results
                are revealed. Higher = stronger anonymity for small teams. This
                replaces the old fixed minimum of five.
              </p>
              <div className="flex gap-4 items-end max-w-md">
                <div>
                  <label className="label">Minimum group size</label>
                  <input
                    type="number"
                    min={1}
                    value={thresholdInput}
                    onChange={(e) => setThresholdInput(e.target.value)}
                    style={{ maxWidth: 120 }}
                  />
                </div>
                <button className="btn" onClick={saveThreshold} disabled={busy}>
                  {thresholdSaved ? "Saved!" : "Save"}
                </button>
              </div>
            </section>

            <section className="mb-16">
              <h2 className="serif text-2xl mb-4">Add a manager</h2>
              <p className="opacity-70 text-sm mb-6 max-w-md">
                Managers are who employees rate. Set a parent to build your
                reporting hierarchy.
              </p>
              <div className="space-y-4 max-w-md">
                <div>
                  <label className="label">Name</label>
                  <input type="text" value={mgrName} onChange={(e) => setMgrName(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Department</label>
                    <input type="text" value={mgrDept} onChange={(e) => setMgrDept(e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Email (optional)</label>
                    <input type="email" value={mgrEmail} onChange={(e) => setMgrEmail(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="label">Reports to (optional)</label>
                  <select
                    className="select"
                    value={mgrParent}
                    onChange={(e) => setMgrParent(e.target.value)}
                  >
                    <option value="">— Top level —</option>
                    {activeManagers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
                <button className="btn" onClick={addManager} disabled={busy || !mgrName.trim()}>
                  Add manager
                </button>
              </div>
            </section>

            <section className="mb-16">
              <h2 className="serif text-2xl mb-6">Current managers</h2>
              {managerRows.length === 0 ? (
                <p className="opacity-60 text-sm">No managers yet.</p>
              ) : (
                <div className="space-y-2 max-w-2xl">
                  {managerRows.map((m) => (
                    <div
                      key={m.id}
                      className={`flex justify-between items-center border p-4 border-mist ${
                        m.active ? "" : "opacity-50"
                      }`}
                    >
                      <div>
                        <span className="serif text-lg mr-3">{m.name}</span>
                        {m.department && (
                          <span className="mono text-xs opacity-60">{m.department}</span>
                        )}
                        {m.parent_name && (
                          <span className="mono text-xs opacity-50 ml-2">→ {m.parent_name}</span>
                        )}
                        {!m.active && (
                          <span className="mono text-xs uppercase tracking-widest text-clay ml-3">
                            inactive
                          </span>
                        )}
                      </div>
                      <button
                        className="mono text-xs uppercase tracking-widest opacity-60 hover:opacity-100 disabled:opacity-30"
                        disabled={busy}
                        onClick={() => toggleManager(m.id, !m.active)}
                      >
                        {m.active ? "Deactivate" : "Reactivate"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h2 className="serif text-2xl mb-4">Generate invitation codes</h2>
              <p className="opacity-70 text-sm mb-6 max-w-md">
                Each code is single-use. Bind codes to a specific manager so the
                feedback aggregates there automatically, or leave open and let
                the respondent pick.
              </p>
              <div className="flex flex-wrap gap-4 items-end max-w-2xl mb-6">
                <div>
                  <label className="label">How many</label>
                  <input
                    type="number"
                    min={1}
                    value={tokenCount}
                    onChange={(e) => setTokenCount(parseInt(e.target.value) || 1)}
                    style={{ maxWidth: 100 }}
                  />
                </div>
                <div>
                  <label className="label">Valid days</label>
                  <input
                    type="number"
                    min={1}
                    value={tokenDays}
                    onChange={(e) => setTokenDays(parseInt(e.target.value) || 30)}
                    style={{ maxWidth: 100 }}
                  />
                </div>
                <div className="flex-1 min-w-[180px]">
                  <label className="label">Bind to manager</label>
                  <select
                    className="select"
                    value={tokenManager}
                    onChange={(e) => setTokenManager(e.target.value)}
                  >
                    <option value="">Any (respondent picks)</option>
                    {activeManagers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
                <button className="btn" onClick={genTokens} disabled={busy}>
                  Generate
                </button>
              </div>
              {generatedTokens.length > 0 && (
                <div className="border border-mist p-4 bg-white">
                  <div className="flex justify-between items-center mb-3">
                    <p className="mono text-xs uppercase tracking-widest opacity-60">
                      {generatedTokens.length} codes — copy now, not shown again
                    </p>
                    <button className="mono text-xs uppercase tracking-widest underline-hand" onClick={copyTokens}>
                      {copied ? "Copied!" : "Copy links"}
                    </button>
                  </div>
                  <textarea
                    readOnly
                    style={{ minHeight: 180 }}
                    value={generatedTokens
                      .map((t) => `${baseUrl}/respond?code=${t}    ${t}`)
                      .join("\n")}
                  />
                </div>
              )}
            </section>
          </>
        )}

        {tab === "employees" && (
          <>
            <h1 className="serif text-4xl md:text-5xl mb-3">Employees</h1>
            <p className="opacity-70 text-sm mb-12 max-w-xl">
              Your employee list is used only to distribute codes and (optionally)
              email them. It is never linked to any response.
            </p>

            <section className="mb-16">
              <h2 className="serif text-2xl mb-4">Import from CSV</h2>
              <p className="opacity-70 text-sm mb-4 max-w-xl">
                Columns: <span className="mono">name</span> (required),{" "}
                <span className="mono">email</span>, <span className="mono">department</span>,{" "}
                <span className="mono">manager</span> (matched to a manager name).
              </p>
              <div className="flex flex-wrap gap-4 items-center mb-4">
                <a className="btn-ghost btn" href="/api/admin/employees/template">
                  Download sample CSV
                </a>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="mono text-xs"
                  onChange={(e) => e.target.files?.[0] && importCsv(e.target.files[0])}
                />
              </div>
              {importMsg && (
                <div
                  className={`border p-4 text-sm mt-2 ${
                    importMsg.ok ? "border-sage" : "border-clay"
                  }`}
                >
                  {importMsg.ok ? (
                    <p className="text-sage mono text-xs uppercase tracking-widest mb-1">
                      Imported {importMsg.added} employee
                      {importMsg.added === 1 ? "" : "s"}
                    </p>
                  ) : (
                    <p className="text-clay mono text-xs uppercase tracking-widest mb-2">
                      Import failed — fix these and re-upload:
                    </p>
                  )}
                  {(importMsg.errors || []).map((e, i) => (
                    <p key={i} className="text-clay text-sm">
                      — {e}
                    </p>
                  ))}
                  {(importMsg.warnings || []).map((w, i) => (
                    <p key={i} className="opacity-70 text-sm">
                      ⚠ {w}
                    </p>
                  ))}
                </div>
              )}
            </section>

            <section className="mb-16">
              <h2 className="serif text-2xl mb-4">Add one manually</h2>
              <div className="grid sm:grid-cols-2 gap-4 max-w-2xl">
                <div>
                  <label className="label">Name</label>
                  <input type="text" value={empName} onChange={(e) => setEmpName(e.target.value)} />
                </div>
                <div>
                  <label className="label">Email</label>
                  <input type="email" value={empEmail} onChange={(e) => setEmpEmail(e.target.value)} />
                </div>
                <div>
                  <label className="label">Department</label>
                  <input type="text" value={empDept} onChange={(e) => setEmpDept(e.target.value)} />
                </div>
                <div>
                  <label className="label">Manager</label>
                  <select className="select" value={empManager} onChange={(e) => setEmpManager(e.target.value)}>
                    <option value="">— None —</option>
                    {activeManagers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <button className="btn mt-5" onClick={addEmployee} disabled={busy || !empName.trim()}>
                Add employee
              </button>
            </section>

            <section className="mb-16">
              <div className="flex flex-wrap gap-4 justify-between items-end mb-6">
                <h2 className="serif text-2xl">Roster ({employees.length})</h2>
                {employees.length > 0 && (
                  <button className="btn" onClick={genEmployeeCodes} disabled={busy}>
                    Generate a code per employee
                  </button>
                )}
              </div>

              {recipients.length > 0 && (
                <div className="border border-sage p-4 mb-6">
                  <div className="flex justify-between items-center mb-2">
                    <p className="mono text-xs uppercase tracking-widest text-sage">
                      {recipients.length} personal codes generated
                    </p>
                    <button className="mono text-xs uppercase tracking-widest underline-hand" onClick={downloadMerge}>
                      Download mail-merge CSV
                    </button>
                  </div>
                  <p className="text-sm opacity-70">
                    Each row has the employee&apos;s name, email and a unique
                    single-use link. Mail-merge it, or paste into your email tool.
                  </p>
                </div>
              )}

              {employees.length === 0 ? (
                <p className="opacity-60 text-sm">
                  No employees yet — import a CSV or add one above.
                </p>
              ) : (
                <div className="overflow-x-auto border border-mist">
                  <table className="w-full text-sm min-w-[560px]">
                    <thead>
                      <tr className="border-b border-mist text-left">
                        {["Name", "Email", "Department", "Manager", ""].map((h) => (
                          <th key={h} className="mono text-[10px] uppercase tracking-widest opacity-60 font-normal px-4 py-3">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {employees.map((e) => (
                        <tr key={e.id} className="border-b border-mist last:border-0">
                          <td className="px-4 py-3">{e.name}</td>
                          <td className="px-4 py-3 mono text-xs opacity-70">{e.email || "—"}</td>
                          <td className="px-4 py-3">{e.department || "—"}</td>
                          <td className="px-4 py-3">{e.manager_name || "—"}</td>
                          <td className="px-4 py-3 text-right">
                            <button
                              className="mono text-xs opacity-50 hover:opacity-100 hover:text-clay"
                              disabled={busy}
                              onClick={() => deleteEmployee(e.id)}
                            >
                              remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function csvCell(v: string) {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function Metric({
  label,
  value,
  small,
}: {
  label: string;
  value: number | null;
  small?: boolean;
}) {
  return (
    <div>
      <p className="mono text-xs uppercase tracking-widest opacity-60 mb-1">{label}</p>
      <p className={`serif ${small ? "text-3xl" : "text-4xl"}`}>
        {value != null ? value.toFixed(2) : "—"}
        <span className="text-sm opacity-40 ml-1">/5</span>
      </p>
    </div>
  );
}

function SuppressedBox({ message }: { message: string }) {
  return (
    <div className="border border-dashed border-clay p-4 text-sm text-clay mono">
      {message}
    </div>
  );
}
