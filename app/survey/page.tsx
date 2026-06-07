"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Manager = { id: number; name: string; department: string | null };
type Option = { label: string; weight: number };
type Question = {
  id: number;
  text: string;
  type: "scale" | "nps" | "single" | "multi" | "text";
  options: Option[] | null;
  required: boolean;
};
type Org = { name: string; logo: string | null };

const SCALE = [
  { v: 1, label: "Strongly disagree" },
  { v: 2, label: "Disagree" },
  { v: 3, label: "Neutral" },
  { v: 4, label: "Agree" },
  { v: 5, label: "Strongly agree" },
];

const CLOSED_MESSAGES: Record<string, string> = {
  used: "This invitation has already been used.",
  expired: "This invitation has expired.",
  closed: "This survey is closed.",
  not_open: "This survey hasn't opened yet.",
  invalid: "That invitation code wasn't recognised.",
};

export default function Survey() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<"loading" | "open" | "closed">("loading");
  const [reason, setReason] = useState("invalid");
  const [org, setOrg] = useState<Org | null>(null);
  const [survey, setSurvey] = useState<{ title: string; description: string | null; collect_manager: boolean } | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [boundManager, setBoundManager] = useState<Manager | null>(null);
  const [managerId, setManagerId] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [step, setStep] = useState<"manager" | "questions">("questions");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const t = decodeURIComponent(window.location.hash.replace(/^#/, ""));
    if (!t) {
      router.replace("/");
      return;
    }
    setToken(t);
    fetch("/api/survey/form", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: t }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (!d.open) {
          setReason(d.reason || "invalid");
          setStatus("closed");
          return;
        }
        setOrg(d.org || null);
        setSurvey(d.survey);
        setQuestions(d.questions || []);
        setManagers(d.managers || []);
        setBoundManager(d.boundManager || null);
        if (d.boundManager) setManagerId(d.boundManager.id);
        const needManager = d.survey.collect_manager && !d.boundManager;
        setStep(needManager ? "manager" : "questions");
        setStatus("open");
      })
      .catch(() => {
        setReason("invalid");
        setStatus("closed");
      });
  }, [router]);

  function setAnswer(qid: number, v: any) {
    setAnswers((a) => ({ ...a, [qid]: v }));
  }

  function firstUnanswered(): Question | null {
    for (const q of questions) {
      const a = answers[q.id];
      const empty = a == null || a === "" || (Array.isArray(a) && a.length === 0);
      if (q.required && empty) return q;
    }
    return null;
  }

  async function submit() {
    const miss = firstUnanswered();
    if (miss) {
      setError(`Please answer: "${miss.text}"`);
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const r = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, manager_id: managerId, answers }),
      });
      const d = await r.json();
      if (d.ok) {
        window.location.hash = "";
        router.replace("/thank-you");
      } else if (d.error === "validation") {
        setError(d.message || "Please complete all required questions.");
      } else if (d.error === "invalid_or_used_token") {
        setError("This invitation can no longer be used.");
      } else {
        setError("Couldn't submit. Please try again.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (status === "loading") {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="mono text-xs opacity-50">Loading survey...</p>
      </main>
    );
  }

  if (status === "closed") {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-8 text-center">
        <p className="mono text-xs uppercase tracking-widest text-clay mb-4">Unavailable</p>
        <h1 className="serif text-4xl mb-6">{CLOSED_MESSAGES[reason] || CLOSED_MESSAGES.invalid}</h1>
        <a href="/" className="mono text-xs uppercase tracking-widest underline-hand">Return home</a>
      </main>
    );
  }

  const needManager = survey?.collect_manager && !boundManager;

  return (
    <main className="min-h-screen flex flex-col">
      <header className="px-6 md:px-8 py-5 flex justify-between items-center border-b border-mist">
        <div className="flex items-center gap-2.5">
          <span className="serif text-xl">Anonvey</span>
          {org?.logo && (
            <>
              <span className="opacity-30">×</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={org.logo} alt={`${org.name} logo`} className="h-7 w-7 object-contain" />
            </>
          )}
          {org?.name && <span className="mono text-xs opacity-50 hidden sm:inline">{org.name}</span>}
        </div>
        <span className="mono text-xs opacity-50">Anonymous</span>
      </header>

      <div className="flex-1 px-6 md:px-8 py-10 md:py-12">
        <div className="max-w-2xl mx-auto">
          {step === "manager" && needManager ? (
            <div className="fade-up">
              <p className="mono text-xs uppercase tracking-widest text-sage mb-4">About your manager</p>
              <h2 className="serif text-3xl md:text-4xl mb-6">Who is your direct manager?</h2>
              <p className="opacity-70 mb-8 text-sm">
                Your selection determines which manager your feedback aggregates
                under. Results are only shared in groups above the threshold.
              </p>
              <div className="space-y-2 mb-10">
                {managers.map((m) => (
                  <label
                    key={m.id}
                    className={`block border p-4 cursor-pointer transition ${
                      managerId === m.id ? "border-ink bg-ink text-paper" : "border-mist hover:border-ink"
                    }`}
                  >
                    <input type="radio" name="manager" className="hidden" checked={managerId === m.id} onChange={() => setManagerId(m.id)} />
                    <div className="flex justify-between items-center">
                      <span className="serif text-lg">{m.name}</span>
                      {m.department && <span className="mono text-xs opacity-60">{m.department}</span>}
                    </div>
                  </label>
                ))}
                {managers.length === 0 && (
                  <p className="opacity-60 text-sm">No managers configured. You can continue.</p>
                )}
              </div>
              <button className="btn" disabled={managers.length > 0 && !managerId} onClick={() => setStep("questions")}>
                Continue
              </button>
            </div>
          ) : (
            <div className="fade-up">
              <h1 className="serif text-3xl md:text-4xl mb-2">{survey?.title}</h1>
              {survey?.description && <p className="opacity-70 mb-10">{survey.description}</p>}

              <div className="space-y-12">
                {questions.map((q, i) => (
                  <div key={q.id}>
                    <p className="serif text-xl mb-1 leading-snug">
                      {q.text}
                      {q.required && <span className="text-clay ml-1">*</span>}
                    </p>
                    <p className="mono text-[10px] uppercase tracking-widest opacity-40 mb-4">
                      Question {i + 1} of {questions.length}
                    </p>
                    <QuestionInput q={q} value={answers[q.id]} onChange={(v) => setAnswer(q.id, v)} />
                  </div>
                ))}
              </div>

              {error && <p className="text-sm text-clay mono mt-8">{error}</p>}

              <div className="flex gap-3 mt-12">
                {needManager && (
                  <button className="btn-ghost btn" onClick={() => setStep("manager")}>Back</button>
                )}
                <button className="btn" disabled={submitting} onClick={submit}>
                  {submitting ? "Submitting..." : "Submit anonymously"}
                </button>
              </div>
              <p className="mono text-xs opacity-40 mt-6">
                Once submitted, your code becomes unusable and your answers cannot be traced back to you.
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function QuestionInput({ q, value, onChange }: { q: Question; value: any; onChange: (v: any) => void }) {
  if (q.type === "scale") {
    return (
      <div className="flex flex-wrap gap-2">
        {SCALE.map((opt) => (
          <button
            key={opt.v}
            type="button"
            onClick={() => onChange(opt.v)}
            className={`px-4 py-2 border mono text-xs uppercase tracking-wider transition ${
              value === opt.v ? "bg-ink text-paper border-ink" : "border-mist hover:border-ink"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    );
  }
  if (q.type === "nps") {
    return (
      <div>
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: 11 }, (_, n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              className={`w-10 h-10 border mono text-sm transition ${
                value === n ? "bg-ink text-paper border-ink" : "border-mist hover:border-ink"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="flex justify-between mono text-[10px] uppercase tracking-widest opacity-40 mt-2">
          <span>Not likely</span>
          <span>Very likely</span>
        </div>
      </div>
    );
  }
  if (q.type === "single") {
    return (
      <div className="space-y-2">
        {(q.options || []).map((o, idx) => (
          <label
            key={idx}
            className={`block border p-3 cursor-pointer transition ${
              value === idx ? "border-ink bg-ink text-paper" : "border-mist hover:border-ink"
            }`}
          >
            <input type="radio" name={`q${q.id}`} className="hidden" checked={value === idx} onChange={() => onChange(idx)} />
            {o.label}
          </label>
        ))}
      </div>
    );
  }
  if (q.type === "multi") {
    const arr: number[] = Array.isArray(value) ? value : [];
    return (
      <div className="space-y-2">
        {(q.options || []).map((o, idx) => {
          const on = arr.includes(idx);
          return (
            <label
              key={idx}
              className={`block border p-3 cursor-pointer transition ${
                on ? "border-ink bg-ink text-paper" : "border-mist hover:border-ink"
              }`}
            >
              <input
                type="checkbox"
                className="hidden"
                checked={on}
                onChange={() => onChange(on ? arr.filter((x) => x !== idx) : [...arr, idx])}
              />
              {o.label}
            </label>
          );
        })}
      </div>
    );
  }
  return (
    <textarea
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      maxLength={2000}
      placeholder="Stay general — specific details can identify you."
    />
  );
}
