"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function validateAndGo(raw: string) {
    const cleaned = raw.trim();
    if (!cleaned) return;
    setError("");
    setLoading(true);
    try {
      const r = await fetch("/api/validate-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: cleaned }),
      });
      const data = await r.json();
      if (data.valid) {
        // Pass token via URL fragment so it's not in server logs
        router.push(`/survey#${encodeURIComponent(cleaned)}`);
      } else {
        if (data.reason === "used")
          setError("This invitation has already been used.");
        else if (data.reason === "expired")
          setError("This invitation has expired.");
        else setError("That invitation code wasn't recognised.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // Pick up an invite code handed out as a link (e.g. /?code=abc123), prefill
  // it, scrub it from the address bar/history, and validate automatically.
  useEffect(() => {
    let code = new URLSearchParams(window.location.search).get("code");
    if (!code && window.location.hash) {
      const hash = window.location.hash.replace(/^#/, "");
      code = new URLSearchParams(hash).get("code") || decodeURIComponent(hash);
    }
    if (code) {
      const cleaned = code.trim();
      setToken(cleaned);
      window.history.replaceState(null, "", window.location.pathname);
      validateAndGo(cleaned);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    validateAndGo(token);
  }

  return (
    <main className="min-h-screen flex flex-col">
      <header className="px-8 py-6 flex justify-between items-center">
        <div className="serif text-xl">Candor</div>
        <a
          href="/admin"
          className="mono text-xs opacity-50 hover:opacity-100 transition"
        >
          admin
        </a>
      </header>

      <div className="flex-1 flex items-center justify-center px-8 py-12">
        <div className="max-w-xl w-full">
          <div className="fade-up" style={{ animationDelay: "0.1s" }}>
            <p className="mono text-xs uppercase tracking-widest text-sage mb-6">
              Anonymous · Confidential · Yours
            </p>
            <h1 className="serif text-5xl md:text-6xl leading-[1.05] mb-8">
              Your honest perspective,
              <br />
              <em className="text-clay">held in confidence.</em>
            </h1>
            <p className="text-lg leading-relaxed mb-10 max-w-md opacity-80">
              This is a space to share how things really are — your manager,
              the culture, the unsaid. Nothing here is tied to you. Nothing
              ever will be.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="fade-up space-y-6"
            style={{ animationDelay: "0.3s" }}
          >
            <div>
              <label className="mono text-xs uppercase tracking-widest opacity-60 block mb-2">
                Invitation code
              </label>
              <input
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="paste your code here"
                autoFocus
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            {error && (
              <p className="text-sm text-clay mono">{error}</p>
            )}
            <button
              type="submit"
              className="btn"
              disabled={loading || !token.trim()}
            >
              {loading ? "Checking..." : "Continue"}
            </button>
          </form>

          <div
            className="fade-up mt-16 pt-8 border-t border-mist"
            style={{ animationDelay: "0.5s" }}
          >
            <h2 className="mono text-xs uppercase tracking-widest opacity-60 mb-4">
              How anonymity works here
            </h2>
            <ul className="text-sm leading-relaxed space-y-2 opacity-80">
              <li>
                — Your invitation code is single-use and never stored alongside
                your answers.
              </li>
              <li>
                — We don't log your IP, your browser, or the time you submitted
                beyond the day.
              </li>
              <li>
                — Results are only shown to leadership in groups of five or
                more.
              </li>
              <li>
                — Free-text comments are shown in random order, never linked to
                a manager rating from the same person.
              </li>
            </ul>
          </div>
        </div>
      </div>

      <footer className="px-8 py-6 mono text-xs opacity-40 text-center">
        Built with care · No tracking · No analytics
      </footer>
    </main>
  );
}
