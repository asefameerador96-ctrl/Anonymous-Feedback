"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const r = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setLoading(false);
    if (r.ok) router.push("/admin");
    else setError("Incorrect email or password.");
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-8">
      <div className="max-w-sm w-full">
        <a href="/" className="serif text-2xl block mb-8">
          Anonvey
        </a>
        <p className="mono text-xs uppercase tracking-widest text-sage mb-3">
          Admin sign in
        </p>
        <h1 className="serif text-4xl mb-8">Welcome back</h1>
        <form onSubmit={submit} className="space-y-6">
          <div>
            <label className="mono text-xs uppercase tracking-widest opacity-60 block mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              autoFocus
            />
          </div>
          <div>
            <label className="mono text-xs uppercase tracking-widest opacity-60 block mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          {error && <p className="text-sm text-clay mono">{error}</p>}
          <button className="btn" disabled={loading}>
            {loading ? "..." : "Enter"}
          </button>
        </form>
        <p className="mono text-xs opacity-60 mt-8">
          New here?{" "}
          <a href="/register" className="underline-hand text-ink">
            Register your organisation
          </a>
        </p>
      </div>
    </main>
  );
}
