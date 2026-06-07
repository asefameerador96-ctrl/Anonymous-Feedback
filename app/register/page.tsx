"use client";

import { useState } from "react";
import Link from "next/link";

type Errors = Record<string, string>;

export default function Register() {
  const [form, setForm] = useState({
    company_name: "",
    work_email: "",
    phone: "",
    employee_count: "",
  });
  const [errors, setErrors] = useState<Errors>({});
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  function set(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: "" }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrors({});
    try {
      const r = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          employee_count: Number(form.employee_count),
        }),
      });
      const data = await r.json();
      if (data.ok) {
        setDone(true);
      } else {
        setErrors(data.errors || { work_email: "Something went wrong." });
      }
    } catch {
      setErrors({ work_email: "Network error. Please try again." });
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-8 text-center">
        <div className="fade-up max-w-lg">
          <p className="mono text-xs uppercase tracking-widest text-sage mb-6">
            Request received
          </p>
          <h1 className="serif text-5xl md:text-6xl leading-tight mb-8">
            You&apos;re on the <em className="text-clay">trial.</em>
          </h1>
          <p className="opacity-80 leading-relaxed mb-10">
            Your workspace is being prepared. You can run up to ten surveys free
            while you evaluate Anonvey — we&apos;ll email{" "}
            <span className="mono text-sm">{form.work_email}</span> with your
            sign-in details and the next step to onboard your organisation.
          </p>
          <Link href="/" className="mono text-xs uppercase tracking-widest underline-hand">
            Back to home
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col">
      <header className="px-6 md:px-10 py-5 flex justify-between items-center">
        <Link href="/" className="serif text-2xl">
          Anonvey
        </Link>
        <Link
          href="/admin/login"
          className="mono text-xs uppercase tracking-widest opacity-60 hover:opacity-100 transition"
        >
          Sign in
        </Link>
      </header>

      <div className="flex-1 flex items-center justify-center px-6 md:px-8 py-12">
        <div className="max-w-md w-full">
          <p className="mono text-xs uppercase tracking-widest text-sage mb-4">
            Start free · up to 10 surveys
          </p>
          <h1 className="serif text-4xl md:text-5xl mb-3">
            Onboard your organisation
          </h1>
          <p className="opacity-70 text-sm mb-10">
            Register with your official work email. No card required to start —
            the $100-per-admin plan unlocks unlimited surveys when you&apos;re
            ready.
          </p>

          <form onSubmit={submit} className="space-y-6">
            <Field
              label="Company / organisation name"
              value={form.company_name}
              onChange={(v) => set("company_name", v)}
              error={errors.company_name}
              autoFocus
            />
            <Field
              label="Work email"
              type="email"
              placeholder="you@yourcompany.com"
              value={form.work_email}
              onChange={(v) => set("work_email", v)}
              error={errors.work_email}
            />
            <Field
              label="Phone number"
              type="tel"
              placeholder="+1 555 000 0000"
              value={form.phone}
              onChange={(v) => set("phone", v)}
              error={errors.phone}
            />
            <Field
              label="Employee headcount"
              type="number"
              placeholder="e.g. 120"
              value={form.employee_count}
              onChange={(v) => set("employee_count", v)}
              error={errors.employee_count}
            />

            <button type="submit" className="btn w-full" disabled={loading}>
              {loading ? "Creating your workspace..." : "Create free workspace"}
            </button>
            <p className="mono text-[11px] opacity-50 leading-relaxed">
              By registering you confirm you&apos;re authorised to run surveys
              for your organisation. We never sell data and cannot read your
              survey results.
            </p>
          </form>
        </div>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  error,
  type = "text",
  placeholder,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  type?: string;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  return (
    <div>
      <label className="mono text-xs uppercase tracking-widest opacity-60 block mb-2">
        {label}
      </label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        className={error ? "!border-b-clay" : ""}
      />
      {error && <p className="text-xs text-clay mono mt-2">{error}</p>}
    </div>
  );
}
