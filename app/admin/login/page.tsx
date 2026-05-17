"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLogin() {
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
      body: JSON.stringify({ password }),
    });
    setLoading(false);
    if (r.ok) router.push("/admin");
    else setError("Incorrect password.");
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-8">
      <div className="max-w-sm w-full">
        <p className="mono text-xs uppercase tracking-widest text-sage mb-6">
          Restricted
        </p>
        <h1 className="serif text-4xl mb-8">Admin</h1>
        <form onSubmit={submit} className="space-y-6">
          <div>
            <label className="mono text-xs uppercase tracking-widest opacity-60 block mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
          </div>
          {error && <p className="text-sm text-clay mono">{error}</p>}
          <button className="btn" disabled={loading}>
            {loading ? "..." : "Enter"}
          </button>
        </form>
      </div>
    </main>
  );
}
