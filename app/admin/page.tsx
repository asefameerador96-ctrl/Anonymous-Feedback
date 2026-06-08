"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type QResult =
  | { kind: "scale"; avg: number | null; count: number }
  | { kind: "nps"; avg: number | null; nps: number | null; count: number }
  | { kind: "choice"; distribution: { label: string; count: number; pct: number }[]; count: number }
  | { kind: "text"; count: number };

type QuestionResult = {
  id: number;
  text: string;
  type: string;
  weight: number;
  result: QResult | null;
};

type Results = {
  org?: { name: string; plan: string; logo: string | null };
  survey?: { id: number; title: string; description: string | null; status: string; collect_manager: boolean };
  threshold: number;
  total: number;
  suppressed: boolean;
  overallScore: number | null;
  questions: QuestionResult[];
  managers: { id: number; name: string; department: string | null; count: number; suppressed: boolean; score: number | null }[];
  comments: { question: string; text: string }[];
};

type Opt = { label: string; weight: number };
type BuilderQuestion = {
  id: number;
  position: number;
  text: string;
  type: "scale" | "nps" | "single" | "multi" | "text";
  options: Opt[] | null;
  weight: number;
  required: boolean;
};
type SurveyMeta = {
  id: number;
  title: string;
  description: string | null;
  status: string;
  collect_manager: boolean;
  opens_at: string | null;
  closes_at: string | null;
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

type Tab = "results" | "survey" | "manage" | "employees";

const QTYPES = [
  { value: "scale", label: "Scale (1–5)" },
  { value: "nps", label: "NPS (0–10)" },
  { value: "single", label: "Single choice" },
  { value: "multi", label: "Multiple choice" },
  { value: "text", label: "Free text" },
] as const;

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
  const [emailConfigured, setEmailConfigured] = useState(false);
  const [emailMsg, setEmailMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // survey builder
  const [surveys, setSurveys] = useState<
    { id: number; title: string; status: string; question_count: number; response_count: number }[]
  >([]);
  const [selectedSurveyId, setSelectedSurveyId] = useState<number | null>(null);
  const [surveyMeta, setSurveyMeta] = useState<SurveyMeta | null>(null);
  const [builderQs, setBuilderQs] = useState<BuilderQuestion[]>([]);
  const [metaSaved, setMetaSaved] = useState(false);

  async function load(surveyId?: number) {
    const sid = surveyId ?? selectedSurveyId;
    const r = await fetch(sid ? `/api/admin/results?survey_id=${sid}` : "/api/admin/results");
    if (r.status === 401) return router.replace("/admin/login");
    const d = await r.json();
    setData(d);
    if (d?.threshold != null) setThresholdInput(String(d.threshold));
  }
  async function loadSurvey(id?: number) {
    const sid = id ?? selectedSurveyId;
    const r = await fetch(sid ? `/api/admin/survey?id=${sid}` : "/api/admin/survey");
    if (r.status === 401) return router.replace("/admin/login");
    const d = await r.json();
    setSurveys(d.surveys || []);
    if (d.survey) {
      setSurveyMeta(d.survey);
      setBuilderQs(d.questions || []);
      setSelectedSurveyId(d.survey.id);
    }
  }
  async function selectSurvey(id: number) {
    setSelectedSurveyId(id);
    await loadSurvey(id);
    await load(id);
  }
  function postSurvey(body: any) {
    return fetch("/api/admin/survey", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }
  async function createSurvey() {
    const title = window.prompt("Name the new survey:", "New survey");
    if (title == null) return;
    setBusy(true);
    const r = await postSurvey({ action: "create_survey", title });
    const d = await r.json();
    setBusy(false);
    if (d.id) selectSurvey(d.id);
  }
  async function deleteSurvey() {
    if (!selectedSurveyId) return;
    if (!window.confirm("Delete this survey and all its responses? This cannot be undone.")) return;
    setBusy(true);
    const r = await postSurvey({ action: "delete_survey", id: selectedSurveyId });
    const d = await r.json();
    setBusy(false);
    if (d.error === "last_survey") {
      window.alert("You must keep at least one survey.");
      return;
    }
    setSelectedSurveyId(null);
    await loadSurvey();
    await load();
  }
  async function saveSurveyMeta() {
    if (!surveyMeta) return;
    setBusy(true);
    await postSurvey({
      action: "update_survey",
      survey_id: surveyMeta.id,
      title: surveyMeta.title,
      description: surveyMeta.description,
      collect_manager: surveyMeta.collect_manager,
      status: surveyMeta.status,
      opens_at: surveyMeta.opens_at || null,
      closes_at: surveyMeta.closes_at || null,
    });
    setBusy(false);
    setMetaSaved(true);
    setTimeout(() => setMetaSaved(false), 2000);
    loadSurvey();
    load();
  }
  async function addQuestion(type: string) {
    if (!selectedSurveyId) return;
    setBusy(true);
    await postSurvey({
      action: "add_question",
      survey_id: selectedSurveyId,
      text: "New question",
      type,
      weight: 1,
      required: true,
      options: type === "single" || type === "multi" ? [{ label: "Option 1", weight: 1 }, { label: "Option 2", weight: 0 }] : null,
    });
    setBusy(false);
    loadSurvey();
  }
  async function saveQuestion(q: BuilderQuestion) {
    setBusy(true);
    await postSurvey({ action: "update_question", ...q });
    setBusy(false);
    loadSurvey();
    load();
  }
  async function deleteQuestion(id: number) {
    setBusy(true);
    await postSurvey({ action: "delete_question", id });
    setBusy(false);
    loadSurvey();
    load();
  }
  async function moveQuestion(id: number, direction: "up" | "down") {
    setBusy(true);
    await postSurvey({ action: "move_question", id, direction });
    setBusy(false);
    loadSurvey();
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
    setEmailConfigured(Boolean(d.emailConfigured));
  }
  async function emailCodes() {
    if (!window.confirm("Email a unique, single-use survey link to every employee who has an email address?")) return;
    setBusy(true);
    setEmailMsg("");
    const r = await postEmp({ action: "email_employee_codes", survey_id: selectedSurveyId, days: tokenDays });
    const d = await r.json();
    setBusy(false);
    if (d.ok) setEmailMsg(`Sent ${d.sent} email${d.sent === 1 ? "" : "s"}${d.failed ? `, ${d.failed} failed` : ""}.`);
    else if (d.error === "no_emails") setEmailMsg("No employees have an email address.");
    else if (d.error === "email_not_configured") setEmailMsg("Email isn't configured yet.");
    else setEmailMsg("Couldn't send. Please try again.");
  }

  useEffect(() => {
    load();
    loadManagers();
    loadEmployees();
    loadSurvey();
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
      survey_id: selectedSurveyId,
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
    const r = await post({ action: "generate_employee_tokens", days: tokenDays, survey_id: selectedSurveyId });
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
    const sid = data?.survey?.id;
    const r = await fetch(sid ? `/api/admin/report?survey_id=${sid}` : "/api/admin/report");
    if (!r.ok) return;
    const text = await r.text();
    downloadText("anonvey-report.csv", text);
  }

  async function downloadPdf() {
    if (!data) return;
    setBusy(true);
    try {
      const { jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;
      const doc = new jsPDF();
      const date = new Date().toISOString().slice(0, 10);

      // Company logo, top-right.
      if (data.org?.logo) await addLogo(doc, data.org.logo);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text("Anonvey Report", 14, 20);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.text(`${data.org?.name || ""} — ${data.survey?.title || "Survey"}`, 14, 28);
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text(
        `Generated ${date} · Minimum group size ${data.threshold} · ${data.total} responses`,
        14,
        34
      );
      doc.setTextColor(0);

      if (data.suppressed) {
        doc.setFontSize(11);
        doc.text(
          `Results are hidden until ${data.threshold} people respond (${data.total} so far).`,
          14,
          50
        );
        doc.save(`anonvey-report-${date}.pdf`);
        return;
      }

      doc.setFontSize(13);
      doc.text(
        `Overall score: ${data.overallScore != null ? data.overallScore.toFixed(1) : "—"} / 100`,
        14,
        46
      );

      autoTable(doc, {
        startY: 54,
        head: [["Question", "Type", "Result", "n"]],
        body: data.questions.map((q) => [q.text, q.type, pdfResult(q.result), String(pdfCount(q.result))]),
        styles: { fontSize: 9, cellPadding: 2 },
        headStyles: { fillColor: [26, 26, 26] },
        columnStyles: { 0: { cellWidth: 95 } },
      });

      let y = (doc as any).lastAutoTable.finalY + 10;
      if (data.survey?.collect_manager && data.managers.length) {
        autoTable(doc, {
          startY: y,
          head: [["Manager", "Department", "Score /100", "n"]],
          body: data.managers.map((m) => [
            m.name,
            m.department || "—",
            m.suppressed ? "suppressed" : m.score != null ? m.score.toFixed(1) : "—",
            String(m.count),
          ]),
          styles: { fontSize: 9, cellPadding: 2 },
          headStyles: { fillColor: [26, 26, 26] },
        });
        y = (doc as any).lastAutoTable.finalY + 10;
      }

      if (data.comments.length) {
        autoTable(doc, {
          startY: y,
          head: [["Question", "Comment"]],
          body: data.comments.map((c) => [c.question, c.text]),
          styles: { fontSize: 9, cellPadding: 2 },
          headStyles: { fillColor: [184, 146, 122] },
          columnStyles: { 0: { cellWidth: 55 } },
        });
      }

      doc.save(`anonvey-report-${date}.pdf`);
    } finally {
      setBusy(false);
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
          </div>
          <nav className="flex gap-4 mono text-xs uppercase tracking-widest">
            {(["results", "survey", "manage", "employees"] as Tab[]).map((t) => (
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
                  Min group size {data.threshold}
                </p>
                <h1 className="serif text-4xl md:text-5xl">Results</h1>
              </div>
              <div className="flex flex-wrap gap-3 items-end">
                {surveys.length > 1 && (
                  <select
                    className="select"
                    style={{ maxWidth: 240 }}
                    value={data.survey?.id ?? ""}
                    onChange={(e) => selectSurvey(Number(e.target.value))}
                  >
                    {surveys.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title}
                      </option>
                    ))}
                  </select>
                )}
                <button className="btn-ghost btn" onClick={downloadReport} disabled={busy}>
                  Export CSV
                </button>
                <button className="btn-ghost btn" onClick={downloadPdf} disabled={busy}>
                  Export PDF
                </button>
              </div>
            </div>

            {data.total === 0 ? (
              <p className="opacity-60">
                No responses yet. Build your survey, then generate codes in the
                Manage tab.
              </p>
            ) : data.suppressed ? (
              <SuppressedBox
                message={`Results are hidden until ${data.threshold} people respond — ${data.total} so far.`}
              />
            ) : (
              <>
                <section className="mb-14">
                  <div className="flex items-end gap-10 flex-wrap">
                    <div>
                      <p className="mono text-xs uppercase tracking-widest opacity-60 mb-1">
                        Overall score
                      </p>
                      <p className="serif text-6xl">
                        {data.overallScore != null ? data.overallScore.toFixed(1) : "—"}
                        <span className="text-xl opacity-40 ml-1">/100</span>
                      </p>
                    </div>
                    <div>
                      <p className="mono text-xs uppercase tracking-widest opacity-60 mb-1">
                        Responses
                      </p>
                      <p className="serif text-6xl">{data.total}</p>
                    </div>
                  </div>
                </section>

                <section className="mb-14">
                  <h2 className="serif text-2xl mb-6">By question</h2>
                  <div className="space-y-5">
                    {data.questions.map((q) => (
                      <div key={q.id} className="border border-mist p-5">
                        <div className="flex justify-between gap-4 items-start mb-3">
                          <p className="serif text-lg">{q.text}</p>
                          <span className="mono text-[10px] uppercase tracking-widest opacity-50 whitespace-nowrap">
                            {q.type} · w{q.weight}
                          </span>
                        </div>
                        <QuestionResultView r={q.result} />
                      </div>
                    ))}
                  </div>
                </section>

                {data.survey?.collect_manager && data.managers.length > 0 && (
                  <section className="mb-14">
                    <h2 className="serif text-2xl mb-6">By manager</h2>
                    <div className="space-y-3">
                      {data.managers.map((m) => (
                        <div
                          key={m.id}
                          className="flex justify-between items-center border border-mist p-4"
                        >
                          <div>
                            <span className="serif text-lg mr-3">{m.name}</span>
                            {m.department && (
                              <span className="mono text-xs opacity-60">{m.department}</span>
                            )}
                          </div>
                          {m.suppressed ? (
                            <span className="mono text-xs text-clay">
                              suppressed ({m.count})
                            </span>
                          ) : (
                            <span className="serif text-2xl">
                              {m.score != null ? m.score.toFixed(1) : "—"}
                              <span className="text-xs opacity-40 ml-1">
                                /100 · {m.count}
                              </span>
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                <section>
                  <h2 className="serif text-2xl mb-6">Comments (random order)</h2>
                  {data.comments.length === 0 ? (
                    <p className="opacity-60 text-sm">No written comments yet.</p>
                  ) : (
                    <div className="space-y-4">
                      {data.comments.map((c, i) => (
                        <div key={i} className="border-l-2 border-clay pl-4 py-1">
                          <p className="mono text-[10px] uppercase tracking-widest opacity-50 mb-1">
                            {c.question}
                          </p>
                          <p>{c.text}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </>
            )}
          </>
        )}

        {tab === "survey" && (
          <>
            <h1 className="serif text-4xl md:text-5xl mb-3">Survey builder</h1>
            <p className="opacity-70 text-sm mb-8 max-w-xl">
              Design the questionnaire respondents see — reorder, weight, and edit
              questions and options. Run as many surveys as you like.
            </p>
            <div className="flex flex-wrap gap-3 items-center mb-10">
              <label className="mono text-xs uppercase tracking-widest opacity-60">Editing</label>
              <select
                className="select"
                style={{ maxWidth: 300 }}
                value={selectedSurveyId ?? ""}
                onChange={(e) => selectSurvey(Number(e.target.value))}
              >
                {surveys.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title} ({s.question_count}q · {s.response_count}r)
                  </option>
                ))}
              </select>
              <button className="btn-ghost btn !py-2 !px-3 !text-xs" onClick={createSurvey} disabled={busy}>
                + New survey
              </button>
              {surveys.length > 1 && (
                <button className="mono text-xs text-clay opacity-70 hover:opacity-100" onClick={deleteSurvey} disabled={busy}>
                  Delete this survey
                </button>
              )}
            </div>
            {!surveyMeta ? (
              <p className="opacity-60">Loading builder...</p>
            ) : (
              <>
                <section className="mb-14 max-w-2xl">
                  <h2 className="serif text-2xl mb-5">Settings</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="label">Title</label>
                      <input
                        type="text"
                        value={surveyMeta.title}
                        onChange={(e) => setSurveyMeta({ ...surveyMeta, title: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="label">Description</label>
                      <textarea
                        value={surveyMeta.description || ""}
                        onChange={(e) => setSurveyMeta({ ...surveyMeta, description: e.target.value })}
                        style={{ minHeight: 70 }}
                      />
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="label">Status</label>
                        <select
                          className="select"
                          value={surveyMeta.status}
                          onChange={(e) => setSurveyMeta({ ...surveyMeta, status: e.target.value })}
                        >
                          <option value="active">Active</option>
                          <option value="draft">Draft (not accepting)</option>
                          <option value="closed">Closed</option>
                        </select>
                      </div>
                      <label className="flex items-center gap-2 sm:mt-7 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={surveyMeta.collect_manager}
                          onChange={(e) => setSurveyMeta({ ...surveyMeta, collect_manager: e.target.checked })}
                        />
                        <span className="text-sm">Ask respondents to pick a manager</span>
                      </label>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="label">Opens (optional)</label>
                        <input
                          type="datetime-local"
                          value={toLocal(surveyMeta.opens_at)}
                          onChange={(e) =>
                            setSurveyMeta({ ...surveyMeta, opens_at: e.target.value ? new Date(e.target.value).toISOString() : null })
                          }
                        />
                      </div>
                      <div>
                        <label className="label">Closes (optional)</label>
                        <input
                          type="datetime-local"
                          value={toLocal(surveyMeta.closes_at)}
                          onChange={(e) =>
                            setSurveyMeta({ ...surveyMeta, closes_at: e.target.value ? new Date(e.target.value).toISOString() : null })
                          }
                        />
                      </div>
                    </div>
                    <button className="btn" onClick={saveSurveyMeta} disabled={busy}>
                      {metaSaved ? "Saved!" : "Save settings"}
                    </button>
                  </div>
                </section>

                <section>
                  <h2 className="serif text-2xl mb-5">Questions ({builderQs.length})</h2>
                  <div className="space-y-4">
                    {builderQs.map((q, i) => (
                      <QuestionEditor
                        key={q.id}
                        q={q}
                        index={i}
                        total={builderQs.length}
                        busy={busy}
                        onSave={saveQuestion}
                        onDelete={deleteQuestion}
                        onMove={moveQuestion}
                      />
                    ))}
                  </div>
                  <div className="mt-6 flex flex-wrap gap-2 items-center">
                    <span className="mono text-xs uppercase tracking-widest opacity-60 mr-2">
                      Add question:
                    </span>
                    {QTYPES.map((t) => (
                      <button
                        key={t.value}
                        className="btn-ghost btn !py-2 !px-3 !text-xs"
                        disabled={busy}
                        onClick={() => addQuestion(t.value)}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </section>
              </>
            )}
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
                <div className="min-w-[150px]">
                  <label className="label">For survey</label>
                  <select
                    className="select"
                    value={selectedSurveyId ?? ""}
                    onChange={(e) => selectSurvey(Number(e.target.value))}
                  >
                    {surveys.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title}
                      </option>
                    ))}
                  </select>
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
                  <div className="flex flex-wrap gap-2">
                    <button className="btn-ghost btn" onClick={genEmployeeCodes} disabled={busy}>
                      Generate codes
                    </button>
                    <button
                      className="btn"
                      onClick={emailCodes}
                      disabled={busy || !emailConfigured}
                      title={emailConfigured ? "" : "Email sending isn't configured yet"}
                    >
                      Email codes to everyone
                    </button>
                  </div>
                )}
              </div>
              {employees.length > 0 && !emailConfigured && (
                <p className="mono text-xs opacity-60 mb-4">
                  One-click email isn&apos;t configured yet — use “Generate codes” + the
                  mail-merge CSV below for now.
                </p>
              )}
              {emailMsg && <p className="text-sm text-sage mono mb-4">{emailMsg}</p>}

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

// Re-encode any browser-renderable logo (png/jpeg/webp/svg/gif) to a clean PNG
// via canvas — this normalises odd PNGs so jsPDF accepts them reliably.
async function logoToPng(
  dataUrl: string
): Promise<{ png: string; w: number; h: number } | null> {
  try {
    const img = new Image();
    img.src = dataUrl;
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error("img"));
    });
    const w = img.naturalWidth || 128;
    const h = img.naturalHeight || 128;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, w, h);
    return { png: canvas.toDataURL("image/png"), w, h };
  } catch {
    return null;
  }
}

// Place the org logo in the PDF, top-right. Never throws.
async function addLogo(doc: any, dataUrl: string) {
  try {
    const conv = await logoToPng(dataUrl);
    if (!conv) return;
    const ratio = Math.min(36 / conv.w, 16 / conv.h);
    const dw = conv.w * ratio;
    const dh = conv.h * ratio;
    doc.addImage(conv.png, "PNG", 196 - dw, 12, dw, dh);
  } catch {
    /* skip logo on any error */
  }
}

function pdfResult(r: any): string {
  if (!r) return "—";
  if (r.kind === "scale") return r.avg != null ? `${r.avg.toFixed(2)} / 5` : "—";
  if (r.kind === "nps")
    return `NPS ${r.nps ?? "—"} (avg ${r.avg != null ? r.avg.toFixed(1) : "—"}/10)`;
  if (r.kind === "choice")
    return r.distribution.map((d: any) => `${d.label}: ${d.pct}%`).join(", ");
  return "see comments";
}
function pdfCount(r: any): number | string {
  return r?.count ?? "";
}

function toLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function QuestionResultView({ r }: { r: any }) {
  if (!r) return <p className="opacity-50 mono text-xs">No data.</p>;
  if (r.kind === "scale")
    return (
      <p className="serif text-3xl">
        {r.avg != null ? r.avg.toFixed(2) : "—"}
        <span className="text-sm opacity-40 ml-1">/5 · {r.count} answered</span>
      </p>
    );
  if (r.kind === "nps")
    return (
      <div className="flex items-end gap-6 flex-wrap">
        <p className="serif text-3xl">
          {r.nps != null ? r.nps : "—"}
          <span className="text-sm opacity-40 ml-1">NPS</span>
        </p>
        <p className="mono text-xs opacity-60">
          avg {r.avg != null ? r.avg.toFixed(1) : "—"}/10 · {r.count} answered
        </p>
      </div>
    );
  if (r.kind === "choice")
    return (
      <div className="space-y-2">
        {r.distribution.map((d: any, i: number) => (
          <div key={i}>
            <div className="flex justify-between text-sm mb-1">
              <span>{d.label}</span>
              <span className="mono text-xs opacity-60">
                {d.pct}% · {d.count}
              </span>
            </div>
            <div className="h-2 bg-mist">
              <div className="h-2 bg-sage" style={{ width: `${d.pct}%` }} />
            </div>
          </div>
        ))}
      </div>
    );
  return (
    <p className="mono text-xs opacity-60">
      {r.count} written response{r.count === 1 ? "" : "s"} — see Comments below.
    </p>
  );
}

function QuestionEditor({
  q,
  index,
  total,
  busy,
  onSave,
  onDelete,
  onMove,
}: {
  q: BuilderQuestion;
  index: number;
  total: number;
  busy: boolean;
  onSave: (q: BuilderQuestion) => void;
  onDelete: (id: number) => void;
  onMove: (id: number, d: "up" | "down") => void;
}) {
  const [local, setLocal] = useState<BuilderQuestion>(q);
  useEffect(() => {
    setLocal(q);
  }, [q]);
  const isChoice = local.type === "single" || local.type === "multi";
  const opts = local.options || [];

  function setOpt(i: number, patch: Partial<Opt>) {
    setLocal({ ...local, options: opts.map((o, idx) => (idx === i ? { ...o, ...patch } : o)) });
  }

  return (
    <div className="border border-mist p-4">
      <div className="flex gap-2 items-start">
        <div className="flex flex-col gap-1 pt-1">
          <button className="mono text-xs opacity-50 hover:opacity-100 disabled:opacity-20" disabled={busy || index === 0} onClick={() => onMove(q.id, "up")}>
            ↑
          </button>
          <button className="mono text-xs opacity-50 hover:opacity-100 disabled:opacity-20" disabled={busy || index === total - 1} onClick={() => onMove(q.id, "down")}>
            ↓
          </button>
        </div>
        <div className="flex-1 space-y-3">
          <input type="text" value={local.text} onChange={(e) => setLocal({ ...local, text: e.target.value })} />
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="label">Type</label>
              <select className="select" value={local.type} onChange={(e) => setLocal({ ...local, type: e.target.value as BuilderQuestion["type"] })} style={{ minWidth: 150 }}>
                {QTYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Weight</label>
              <input type="number" min={0} step={0.5} value={local.weight} onChange={(e) => setLocal({ ...local, weight: Number(e.target.value) })} style={{ maxWidth: 90 }} />
            </div>
            <label className="flex items-center gap-2 cursor-pointer pb-2">
              <input type="checkbox" checked={local.required} onChange={(e) => setLocal({ ...local, required: e.target.checked })} />
              <span className="text-sm">Required</span>
            </label>
          </div>

          {isChoice && (
            <div className="border-l-2 border-mist pl-4 space-y-2">
              <p className="mono text-[10px] uppercase tracking-widest opacity-60">Options (label · weight)</p>
              {opts.map((o, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input type="text" value={o.label} onChange={(e) => setOpt(i, { label: e.target.value })} className="flex-1" />
                  <input type="number" value={o.weight} onChange={(e) => setOpt(i, { weight: Number(e.target.value) })} style={{ maxWidth: 80 }} title="weight" />
                  <button className="mono text-xs text-clay opacity-70 hover:opacity-100" onClick={() => setLocal({ ...local, options: opts.filter((_, idx) => idx !== i) })}>
                    ✕
                  </button>
                </div>
              ))}
              <button className="mono text-xs underline-hand" onClick={() => setLocal({ ...local, options: [...opts, { label: "New option", weight: 0 }] })}>
                + add option
              </button>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button className="btn !py-2 !px-4 !text-xs" disabled={busy} onClick={() => onSave(local)}>
              Save
            </button>
            <button className="mono text-xs opacity-50 hover:text-clay" disabled={busy} onClick={() => onDelete(q.id)}>
              Delete
            </button>
          </div>
        </div>
      </div>
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
