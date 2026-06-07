"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Errors = Record<string, string>;

export default function Register() {
  const router = useRouter();
  const [form, setForm] = useState({
    company_name: "",
    work_email: "",
    phone: "",
    employee_count: "",
    password: "",
  });
  const [errors, setErrors] = useState<Errors>({});
  const [loading, setLoading] = useState(false);
  const [logo, setLogo] = useState("");

  function set(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: "" }));
  }

  function onLogo(file?: File) {
    setErrors((e) => ({ ...e, logo: "" }));
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErrors((e) => ({ ...e, logo: "Please choose an image file." }));
      return;
    }
    if (file.size > 250 * 1024) {
      setErrors((e) => ({ ...e, logo: "Image must be under 250 KB." }));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setLogo(String(reader.result || ""));
    reader.readAsDataURL(file);
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
          logo,
        }),
      });
      const data = await r.json();
      if (data.ok) {
        // Account created and logged in — go straight to the dashboard.
        router.push("/admin");
      } else {
        setErrors(data.errors || { work_email: "Something went wrong." });
      }
    } catch {
      setErrors({ work_email: "Network error. Please try again." });
    } finally {
      setLoading(false);
    }
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
            <Field
              label="Choose a password"
              type="password"
              placeholder="at least 6 characters"
              value={form.password}
              onChange={(v) => set("password", v)}
              error={errors.password}
            />

            <div>
              <label className="mono text-xs uppercase tracking-widest opacity-60 block mb-2">
                Company logo (optional)
              </label>
              <div className="flex items-center gap-4">
                {logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logo}
                    alt="Logo preview"
                    className="h-12 w-12 object-contain border border-mist bg-white p-1"
                  />
                ) : (
                  <div className="h-12 w-12 border border-dashed border-mist flex items-center justify-center mono text-[9px] opacity-40">
                    logo
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="mono text-xs"
                  onChange={(e) => onLogo(e.target.files?.[0])}
                />
              </div>
              <p className="mono text-[11px] opacity-50 mt-2">
                Shown beside the Anonvey logo to your admins and survey takers.
              </p>
              {errors.logo && <p className="text-xs text-clay mono mt-2">{errors.logo}</p>}
            </div>

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
