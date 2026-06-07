"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Manager = { id: number; name: string; department: string | null };

const MANAGER_QUESTIONS = [
  {
    key: "manager_clarity",
    label: "My manager sets clear expectations for my work.",
  },
  {
    key: "manager_support",
    label: "My manager supports me when I need help or face obstacles.",
  },
  {
    key: "manager_fairness",
    label: "My manager treats me and my colleagues fairly.",
  },
  {
    key: "manager_growth",
    label: "My manager actively invests in my growth and development.",
  },
] as const;

const CULTURE_QUESTIONS = [
  {
    key: "culture_trust",
    label: "I can be myself at work without fear of judgement.",
  },
  {
    key: "culture_inclusion",
    label: "Different perspectives are genuinely welcomed here.",
  },
  {
    key: "culture_workload",
    label: "My workload is sustainable over the long term.",
  },
  {
    key: "culture_voice",
    label: "When I raise concerns, they are taken seriously.",
  },
] as const;

const LIKERT = [
  { v: 1, label: "Strongly disagree" },
  { v: 2, label: "Disagree" },
  { v: 3, label: "Neutral" },
  { v: 4, label: "Agree" },
  { v: 5, label: "Strongly agree" },
];

export default function Survey() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [tokenChecked, setTokenChecked] = useState(false);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [form, setForm] = useState<Record<string, any>>({});
  const [step, setStep] = useState(0); // 0: manager pick, 1: manager q, 2: culture q, 3: review
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const t = decodeURIComponent(window.location.hash.replace(/^#/, ""));
    if (!t) {
      router.replace("/");
      return;
    }
    setToken(t);
    // Re-validate
    fetch("/api/validate-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: t }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (!d.valid) router.replace("/");
        else setTokenChecked(true);
      })
      .catch(() => router.replace("/"));
  }, [router]);

  useEffect(() => {
    if (!tokenChecked) return;
    fetch("/api/managers")
      .then((r) => r.json())
      .then((d) => setManagers(d.managers || []));
  }, [tokenChecked]);

  function setField(k: string, v: any) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit() {
    setSubmitting(true);
    setError("");
    try {
      const payload = { ...form, token };
      const r = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await r.json();
      if (data.ok) {
        // Clear the token from the URL before navigating
        window.location.hash = "";
        router.replace("/thank-you");
      } else {
        setError(
          data.error === "invalid_or_used_token"
            ? "This invitation can no longer be used."
            : "Couldn't submit. Please try again."
        );
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!tokenChecked) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="mono text-xs opacity-50">Verifying invitation...</p>
      </main>
    );
  }

  const managerComplete = MANAGER_QUESTIONS.every((q) => form[q.key]);
  const cultureComplete = CULTURE_QUESTIONS.every((q) => form[q.key]);

  const selectedManager = managers.find((m) => m.id === form.manager_id);
  const likertLabel = (v: number | undefined) =>
    LIKERT.find((l) => l.v === v)?.label ?? "—";

  return (
    <main className="min-h-screen flex flex-col">
      <header className="px-8 py-6 flex justify-between items-center border-b border-mist">
        <div className="serif text-xl">Anonvey</div>
        <div className="mono text-xs opacity-50">
          Step {step + 1} of 4
        </div>
      </header>

      <div className="flex-1 px-6 md:px-8 py-12">
        <div className="max-w-2xl mx-auto">
          {/* Step 0: Manager selection */}
          {step === 0 && (
            <div className="fade-up">
              <p className="mono text-xs uppercase tracking-widest text-sage mb-4">
                One · About your manager
              </p>
              <h2 className="serif text-3xl md:text-4xl mb-6">
                Who is your direct manager?
              </h2>
              <p className="opacity-70 mb-8 text-sm">
                Your selection determines which manager your feedback is
                aggregated under. Results are only shared in groups of five or
                more.
              </p>
              <div className="space-y-2 mb-10">
                {managers.map((m) => (
                  <label
                    key={m.id}
                    className={`block border p-4 cursor-pointer transition ${
                      form.manager_id === m.id
                        ? "border-ink bg-ink text-paper"
                        : "border-mist hover:border-ink"
                    }`}
                  >
                    <input
                      type="radio"
                      name="manager_id"
                      className="hidden"
                      checked={form.manager_id === m.id}
                      onChange={() => setField("manager_id", m.id)}
                    />
                    <div className="flex justify-between items-center">
                      <span className="serif text-lg">{m.name}</span>
                      {m.department && (
                        <span className="mono text-xs opacity-60">
                          {m.department}
                        </span>
                      )}
                    </div>
                  </label>
                ))}
              </div>
              <button
                className="btn"
                disabled={!form.manager_id}
                onClick={() => setStep(1)}
              >
                Continue
              </button>
            </div>
          )}

          {/* Step 1: Manager ratings */}
          {step === 1 && (
            <div className="fade-up">
              <p className="mono text-xs uppercase tracking-widest text-sage mb-4">
                Two · Your manager
              </p>
              <h2 className="serif text-3xl md:text-4xl mb-8">
                How true do these feel?
              </h2>
              <div className="space-y-10">
                {MANAGER_QUESTIONS.map((q) => (
                  <RatingRow
                    key={q.key}
                    label={q.label}
                    value={form[q.key]}
                    onChange={(v) => setField(q.key, v)}
                  />
                ))}
                <div>
                  <label className="mono text-xs uppercase tracking-widest opacity-60 block mb-3">
                    Anything else about your manager? (optional)
                  </label>
                  <textarea
                    value={form.manager_comments || ""}
                    onChange={(e) =>
                      setField("manager_comments", e.target.value)
                    }
                    placeholder="Stay general — specific incidents or details can identify you."
                    maxLength={2000}
                  />
                  <p className="mono text-xs opacity-40 mt-2">
                    {(form.manager_comments || "").length} / 2000
                  </p>
                </div>
              </div>
              <div className="flex gap-3 mt-12">
                <button className="btn-ghost btn" onClick={() => setStep(0)}>
                  Back
                </button>
                <button
                  className="btn"
                  disabled={!managerComplete}
                  onClick={() => setStep(2)}
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Culture */}
          {step === 2 && (
            <div className="fade-up">
              <p className="mono text-xs uppercase tracking-widest text-sage mb-4">
                Three · The wider culture
              </p>
              <h2 className="serif text-3xl md:text-4xl mb-8">
                And the place itself?
              </h2>
              <div className="space-y-10">
                {CULTURE_QUESTIONS.map((q) => (
                  <RatingRow
                    key={q.key}
                    label={q.label}
                    value={form[q.key]}
                    onChange={(v) => setField(q.key, v)}
                  />
                ))}
                <div>
                  <label className="mono text-xs uppercase tracking-widest opacity-60 block mb-3">
                    Anything else about the culture? (optional)
                  </label>
                  <textarea
                    value={form.culture_comments || ""}
                    onChange={(e) =>
                      setField("culture_comments", e.target.value)
                    }
                    placeholder="What's the one thing you'd want leadership to truly understand?"
                    maxLength={2000}
                  />
                  <p className="mono text-xs opacity-40 mt-2">
                    {(form.culture_comments || "").length} / 2000
                  </p>
                </div>
              </div>
              <div className="flex gap-3 mt-12">
                <button className="btn-ghost btn" onClick={() => setStep(1)}>
                  Back
                </button>
                <button
                  className="btn"
                  disabled={!cultureComplete}
                  onClick={() => setStep(3)}
                >
                  Review
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Review */}
          {step === 3 && (
            <div className="fade-up">
              <p className="mono text-xs uppercase tracking-widest text-sage mb-4">
                Four · Final check
              </p>
              <h2 className="serif text-3xl md:text-4xl mb-6">
                Ready when you are.
              </h2>
              <p className="opacity-70 mb-8 text-sm">
                Once submitted, your invitation code becomes unusable and your
                answers cannot be retrieved or edited. There is no link from
                this submission back to you.
              </p>

              <div className="border border-mist divide-y divide-mist mb-8">
                <div className="px-4 py-3 flex justify-between gap-4">
                  <span className="mono text-xs uppercase tracking-widest opacity-60">
                    Manager
                  </span>
                  <span className="text-sm text-right">
                    {selectedManager ? selectedManager.name : "—"}
                  </span>
                </div>
                {MANAGER_QUESTIONS.map((q) => (
                  <div
                    key={q.key}
                    className="px-4 py-3 flex justify-between gap-4"
                  >
                    <span className="text-sm opacity-80">{q.label}</span>
                    <span className="mono text-xs whitespace-nowrap text-sage">
                      {likertLabel(form[q.key])}
                    </span>
                  </div>
                ))}
                {CULTURE_QUESTIONS.map((q) => (
                  <div
                    key={q.key}
                    className="px-4 py-3 flex justify-between gap-4"
                  >
                    <span className="text-sm opacity-80">{q.label}</span>
                    <span className="mono text-xs whitespace-nowrap text-sage">
                      {likertLabel(form[q.key])}
                    </span>
                  </div>
                ))}
                {(form.manager_comments || form.culture_comments) && (
                  <div className="px-4 py-3">
                    <span className="mono text-xs uppercase tracking-widest opacity-60">
                      Comments included
                    </span>
                  </div>
                )}
              </div>

              {error && (
                <p className="text-sm text-clay mono mb-4">{error}</p>
              )}
              <div className="flex gap-3">
                <button className="btn-ghost btn" onClick={() => setStep(2)}>
                  Back
                </button>
                <button
                  className="btn"
                  disabled={submitting}
                  onClick={submit}
                >
                  {submitting ? "Submitting..." : "Submit anonymously"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function RatingRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | undefined;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <p className="serif text-xl mb-4 leading-snug">{label}</p>
      <div className="flex flex-wrap gap-2">
        {LIKERT.map((opt) => (
          <label key={opt.v} className="rating-pill cursor-pointer">
            <input
              type="radio"
              name={label}
              value={opt.v}
              checked={value === opt.v}
              onChange={() => onChange(opt.v)}
              className="hidden peer"
            />
            <span className="block px-4 py-2 border border-mist mono text-xs uppercase tracking-wider peer-checked:bg-ink peer-checked:text-paper peer-checked:border-ink transition">
              {opt.label}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
