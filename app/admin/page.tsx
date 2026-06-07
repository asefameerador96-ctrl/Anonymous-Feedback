"use client";

import { useEffect, useState } from "react";
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
  org?: { name: string; plan: string };
  threshold: number;
  managers: ManagerResult[];
  culture: Culture;
  comments: { manager: string | null; culture: string | null }[];
};

type ManagerRow = {
  id: number;
  name: string;
  department: string | null;
  active: boolean;
};

export default function AdminDashboard() {
  const router = useRouter();
  const [data, setData] = useState<Results | null>(null);
  const [tab, setTab] = useState<"results" | "manage">("results");
  const [managerRows, setManagerRows] = useState<ManagerRow[]>([]);
  const [newManagerName, setNewManagerName] = useState("");
  const [newManagerDept, setNewManagerDept] = useState("");
  const [tokenCount, setTokenCount] = useState(10);
  const [tokenDays, setTokenDays] = useState(30);
  const [generatedTokens, setGeneratedTokens] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [thresholdInput, setThresholdInput] = useState("");
  const [thresholdSaved, setThresholdSaved] = useState(false);

  async function load() {
    const r = await fetch("/api/admin/results");
    if (r.status === 401) {
      router.replace("/admin/login");
      return;
    }
    const d = await r.json();
    setData(d);
    if (d?.threshold != null) setThresholdInput(String(d.threshold));
  }

  async function saveThreshold() {
    const t = parseInt(thresholdInput, 10);
    if (!Number.isInteger(t) || t < 1) return;
    setBusy(true);
    await fetch("/api/admin/managers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set_threshold", threshold: t }),
    });
    setBusy(false);
    setThresholdSaved(true);
    setTimeout(() => setThresholdSaved(false), 2000);
    load();
  }

  async function loadManagers() {
    const r = await fetch("/api/admin/managers");
    if (r.status === 401) {
      router.replace("/admin/login");
      return;
    }
    const d = await r.json();
    setManagerRows(d.managers || []);
  }

  useEffect(() => {
    load();
    loadManagers();
  }, []);

  async function addManager() {
    if (!newManagerName.trim()) return;
    setBusy(true);
    await fetch("/api/admin/managers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "add_manager",
        name: newManagerName,
        department: newManagerDept,
      }),
    });
    setNewManagerName("");
    setNewManagerDept("");
    setBusy(false);
    loadManagers();
    load();
  }

  async function toggleManager(id: number, active: boolean) {
    setBusy(true);
    await fetch("/api/admin/managers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set_active", id, active }),
    });
    setBusy(false);
    loadManagers();
    load();
  }

  async function genTokens() {
    setBusy(true);
    setCopied(false);
    const r = await fetch("/api/admin/managers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "generate_tokens",
        count: tokenCount,
        days: tokenDays,
      }),
    });
    const d = await r.json();
    if (d.ok) setGeneratedTokens(d.tokens);
    setBusy(false);
  }

  async function copyTokens() {
    const text = generatedTokens
      .map((t) => `${baseUrl}/respond?code=${t}`)
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable (e.g. non-secure context) — the textarea
      // below is still selectable as a fallback.
    }
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

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <main className="min-h-screen">
      <header className="px-8 py-6 flex justify-between items-center border-b border-mist">
        <div className="flex items-center gap-6">
          <div className="serif text-xl">
            Anonvey{" "}
            <span className="opacity-50">/ {data.org?.name || "Admin"}</span>
          </div>
          <nav className="flex gap-4 mono text-xs uppercase tracking-widest">
            <button
              onClick={() => setTab("results")}
              className={tab === "results" ? "text-ink" : "opacity-50"}
            >
              Results
            </button>
            <button
              onClick={() => setTab("manage")}
              className={tab === "manage" ? "text-ink" : "opacity-50"}
            >
              Manage
            </button>
          </nav>
        </div>
        <button onClick={logout} className="mono text-xs opacity-50 hover:opacity-100">
          Sign out
        </button>
      </header>

      <div className="max-w-5xl mx-auto px-8 py-12">
        {tab === "results" && (
          <>
            <p className="mono text-xs uppercase tracking-widest text-sage mb-4">
              Minimum group size: {data.threshold}
            </p>
            <h1 className="serif text-4xl md:text-5xl mb-12">Results</h1>

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
                  <div
                    key={m.id}
                    className="border border-mist p-6"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="serif text-xl">{m.name}</h3>
                        {m.department && (
                          <p className="mono text-xs opacity-60">
                            {m.department}
                          </p>
                        )}
                      </div>
                      <p className="mono text-xs opacity-60">
                        {m.response_count} response
                        {m.response_count === 1 ? "" : "s"}
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
              <h2 className="serif text-2xl mb-6">Anonymity threshold</h2>
              <p className="opacity-70 text-sm mb-6 max-w-md">
                The minimum number of responses required before any group&apos;s
                results are revealed. Set it higher for stronger anonymity in
                small teams, lower to see results sooner. This replaces the old
                fixed minimum of five.
              </p>
              <div className="flex gap-4 items-end max-w-md">
                <div>
                  <label className="mono text-xs uppercase tracking-widest opacity-60 block mb-2">
                    Minimum group size
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={thresholdInput}
                    onChange={(e) => setThresholdInput(e.target.value)}
                    style={{ maxWidth: 120 }}
                  />
                </div>
                <button
                  className="btn"
                  onClick={saveThreshold}
                  disabled={busy}
                >
                  {thresholdSaved ? "Saved!" : "Save"}
                </button>
              </div>
            </section>

            <section className="mb-16">
              <h2 className="serif text-2xl mb-6">Add a manager</h2>
              <div className="space-y-4 max-w-md">
                <div>
                  <label className="mono text-xs uppercase tracking-widest opacity-60 block mb-2">
                    Name
                  </label>
                  <input
                    type="text"
                    value={newManagerName}
                    onChange={(e) => setNewManagerName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mono text-xs uppercase tracking-widest opacity-60 block mb-2">
                    Department (optional)
                  </label>
                  <input
                    type="text"
                    value={newManagerDept}
                    onChange={(e) => setNewManagerDept(e.target.value)}
                  />
                </div>
                <button
                  className="btn"
                  onClick={addManager}
                  disabled={busy || !newManagerName.trim()}
                >
                  Add manager
                </button>
              </div>
            </section>

            <section className="mb-16">
              <h2 className="serif text-2xl mb-6">Current managers</h2>
              <p className="opacity-70 text-sm mb-6 max-w-md">
                Deactivated managers disappear from the survey's selection list
                and from the results page, but their existing responses are kept
                in the aggregates.
              </p>
              {managerRows.length === 0 ? (
                <p className="opacity-60 text-sm">No managers yet.</p>
              ) : (
                <div className="space-y-2 max-w-2xl">
                  {managerRows.map((m) => (
                    <div
                      key={m.id}
                      className={`flex justify-between items-center border p-4 ${
                        m.active ? "border-mist" : "border-mist opacity-50"
                      }`}
                    >
                      <div>
                        <span className="serif text-lg mr-3">{m.name}</span>
                        {m.department && (
                          <span className="mono text-xs opacity-60">
                            {m.department}
                          </span>
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
              <h2 className="serif text-2xl mb-6">Generate invitation codes</h2>
              <p className="opacity-70 text-sm mb-6 max-w-md">
                Each code is single-use. Distribute one per employee — email,
                print, hand them out. The codes table is stored separately
                from responses and cannot be joined back to a submission.
              </p>
              <div className="flex gap-4 items-end max-w-md mb-6">
                <div>
                  <label className="mono text-xs uppercase tracking-widest opacity-60 block mb-2">
                    How many
                  </label>
                  <input
                    type="text"
                    value={tokenCount}
                    onChange={(e) =>
                      setTokenCount(parseInt(e.target.value) || 1)
                    }
                  />
                </div>
                <div>
                  <label className="mono text-xs uppercase tracking-widest opacity-60 block mb-2">
                    Valid days
                  </label>
                  <input
                    type="text"
                    value={tokenDays}
                    onChange={(e) =>
                      setTokenDays(parseInt(e.target.value) || 30)
                    }
                  />
                </div>
                <button className="btn" onClick={genTokens} disabled={busy}>
                  Generate
                </button>
              </div>
              {generatedTokens.length > 0 && (
                <div className="border border-mist p-4 bg-white">
                  <div className="flex justify-between items-center mb-3">
                    <p className="mono text-xs uppercase tracking-widest opacity-60">
                      {generatedTokens.length} codes generated — copy now, they
                      won't be shown again
                    </p>
                    <button
                      className="mono text-xs uppercase tracking-widest underline-hand"
                      onClick={copyTokens}
                    >
                      {copied ? "Copied!" : "Copy links"}
                    </button>
                  </div>
                  <textarea
                    readOnly
                    style={{ minHeight: 200 }}
                    value={generatedTokens
                      .map((t) => `${baseUrl}/respond?code=${t}    ${t}`)
                      .join("\n")}
                  />
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
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
      <p className="mono text-xs uppercase tracking-widest opacity-60 mb-1">
        {label}
      </p>
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
