"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function Home() {
  const router = useRouter();

  // Preserve existing invite links: if someone lands here with ?code=… (or a
  // hash), send them straight into the survey-taking flow.
  useEffect(() => {
    const hasCode =
      new URLSearchParams(window.location.search).get("code") ||
      window.location.hash.replace(/^#/, "");
    if (hasCode) {
      router.replace(`/respond${window.location.search}${window.location.hash}`);
    }
  }, [router]);

  return (
    <main className="min-h-screen flex flex-col">
      {/* Nav */}
      <header className="px-6 md:px-10 py-5 flex justify-between items-center">
        <div className="serif text-2xl tracking-tight">Anonvey</div>
        <nav className="flex items-center gap-5 md:gap-7 mono text-xs uppercase tracking-widest">
          <a href="#how" className="hidden sm:inline opacity-60 hover:opacity-100 transition">
            How it works
          </a>
          <a href="#pricing" className="hidden sm:inline opacity-60 hover:opacity-100 transition">
            Pricing
          </a>
          <Link href="/admin/login" className="opacity-60 hover:opacity-100 transition">
            Sign in
          </Link>
          <Link href="/register" className="btn !py-2.5 !px-4">
            Get started
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="px-6 md:px-10 pt-12 md:pt-24 pb-16 md:pb-28">
        <div className="max-w-4xl mx-auto text-center">
          <p className="fade-up mono text-xs uppercase tracking-[0.3em] text-sage mb-6">
            Anonymous surveys for organisations
          </p>
          <h1 className="fade-up serif text-6xl md:text-8xl leading-[0.95] mb-8" style={{ animationDelay: "0.1s" }}>
            Truly
            <br />
            <em className="text-clay">Anonymous.</em>
          </h1>
          <p
            className="fade-up text-lg md:text-xl leading-relaxed max-w-2xl mx-auto opacity-80 mb-4"
            style={{ animationDelay: "0.2s" }}
          >
            Anonvey lets any organisation run honest employee feedback surveys —
            engagement, culture, manager 360s — with anonymity built into the
            data itself, not just promised in a policy.
          </p>
          <p
            className="fade-up serif text-2xl md:text-3xl text-clay mb-10"
            style={{ animationDelay: "0.3s" }}
          >
            Even we cannot see your results.
          </p>
          <div
            className="fade-up flex flex-col sm:flex-row gap-3 justify-center items-center"
            style={{ animationDelay: "0.4s" }}
          >
            <Link href="/register" className="btn w-full sm:w-auto text-center">
              Start free — up to 10 surveys
            </Link>
            <a href="#how" className="btn-ghost btn w-full sm:w-auto text-center">
              See how it works
            </a>
          </div>
          <p className="fade-up mono text-xs opacity-40 mt-6" style={{ animationDelay: "0.5s" }}>
            No credit card to try · Register with your work email
          </p>
        </div>
      </section>

      {/* Anonymity guarantees */}
      <section className="px-6 md:px-10 py-16 border-t border-mist bg-white/40">
        <div className="max-w-5xl mx-auto">
          <h2 className="serif text-3xl md:text-4xl mb-3 text-center">
            Anonymity that holds up under scrutiny
          </h2>
          <p className="text-center opacity-70 max-w-2xl mx-auto mb-12">
            The hard part of an anonymous survey isn&apos;t the form — it&apos;s
            making sure the data can never be used to deanonymise anyone later.
          </p>
          <div className="grid md:grid-cols-2 gap-6">
            {GUARANTEES.map((g) => (
              <div key={g.title} className="border border-mist p-6 bg-paper">
                <p className="mono text-xs uppercase tracking-widest text-sage mb-2">
                  {g.tag}
                </p>
                <h3 className="serif text-xl mb-2">{g.title}</h3>
                <p className="text-sm leading-relaxed opacity-80">{g.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="px-6 md:px-10 py-20 border-t border-mist scroll-mt-20">
        <div className="max-w-5xl mx-auto">
          <p className="mono text-xs uppercase tracking-widest text-sage mb-3 text-center">
            How it works
          </p>
          <h2 className="serif text-3xl md:text-4xl mb-14 text-center">
            From sign-up to insight in an afternoon
          </h2>
          <div className="grid md:grid-cols-4 gap-8">
            {STEPS.map((s, i) => (
              <div key={s.title}>
                <div className="serif text-5xl text-clay mb-3">{i + 1}</div>
                <h3 className="serif text-xl mb-2">{s.title}</h3>
                <p className="text-sm leading-relaxed opacity-80">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 md:px-10 py-20 border-t border-mist bg-white/40">
        <div className="max-w-5xl mx-auto">
          <p className="mono text-xs uppercase tracking-widest text-sage mb-3 text-center">
            Everything you need
          </p>
          <h2 className="serif text-3xl md:text-4xl mb-14 text-center">
            A full survey platform, not a form
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-10">
            {FEATURES.map((f) => (
              <div key={f.title}>
                <h3 className="serif text-lg mb-1.5">{f.title}</h3>
                <p className="text-sm leading-relaxed opacity-80">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="px-6 md:px-10 py-20 border-t border-mist scroll-mt-20">
        <div className="max-w-4xl mx-auto">
          <p className="mono text-xs uppercase tracking-widest text-sage mb-3 text-center">
            Pricing
          </p>
          <h2 className="serif text-3xl md:text-4xl mb-14 text-center">
            Try it free. Pay once you rely on it.
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            {/* Free */}
            <div className="border border-mist p-8 bg-paper flex flex-col">
              <h3 className="serif text-2xl mb-1">Trial</h3>
              <p className="opacity-70 text-sm mb-6">For evaluating Anonvey end to end.</p>
              <p className="serif text-5xl mb-1">Free</p>
              <p className="mono text-xs opacity-60 mb-6">up to 10 surveys</p>
              <ul className="text-sm space-y-2 opacity-80 mb-8 flex-1">
                <li>— Full feature walkthrough</li>
                <li>— Real anonymous responses</li>
                <li>— CSV import & manager codes</li>
                <li>— Aggregated reports</li>
              </ul>
              <Link href="/register" className="btn-ghost btn text-center">
                Start free
              </Link>
            </div>
            {/* Pro */}
            <div className="border-2 border-ink p-8 bg-ink text-paper flex flex-col relative">
              <span className="absolute top-4 right-4 mono text-[10px] uppercase tracking-widest bg-clay text-paper px-2 py-1">
                Most teams
              </span>
              <h3 className="serif text-2xl mb-1">Organisation</h3>
              <p className="opacity-70 text-sm mb-6">Unlimited surveys for your company.</p>
              <p className="serif text-5xl mb-1">
                $100<span className="text-lg opacity-60"> / admin</span>
              </p>
              <p className="mono text-xs opacity-60 mb-6">one-time onboarding per admin seat</p>
              <ul className="text-sm space-y-2 opacity-90 mb-8 flex-1">
                <li>— Everything in Trial, unlimited</li>
                <li>— Hierarchy & department roll-ups</li>
                <li>— Email-triggered single-use codes</li>
                <li>— Report downloads (CSV / PDF)</li>
                <li>— Priority support</li>
              </ul>
              <Link href="/register" className="btn !bg-paper !text-ink hover:!bg-mist text-center">
                Onboard your company
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Owner-can't-see manifesto */}
      <section className="px-6 md:px-10 py-20 border-t border-mist bg-white/40">
        <div className="max-w-3xl mx-auto text-center">
          <p className="mono text-xs uppercase tracking-widest text-sage mb-4">
            Our promise
          </p>
          <h2 className="serif text-3xl md:text-5xl leading-tight mb-6">
            We run the platform.
            <br />
            <em className="text-clay">We still can&apos;t read your results.</em>
          </h2>
          <p className="text-lg leading-relaxed opacity-80">
            Responses are stripped of every identifier, aggregated only above a
            threshold you set, and walled off from our operations dashboard,
            which sees nothing but billing and usage counts. Anonymity isn&apos;t
            a setting we promise to respect — it&apos;s how the system is built.
          </p>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-6 md:px-10 py-24 border-t border-mist">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="serif text-4xl md:text-5xl mb-8">
            Give your people a voice they trust.
          </h2>
          <Link href="/register" className="btn">
            Get started free
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 md:px-10 py-8 border-t border-mist flex flex-col sm:flex-row justify-between items-center gap-3">
        <div className="serif text-lg">Anonvey</div>
        <p className="mono text-xs opacity-40">Truly Anonymous · No tracking · No analytics</p>
      </footer>
    </main>
  );
}

const GUARANTEES = [
  {
    tag: "Separation",
    title: "Invitation codes never touch responses",
    body: "Codes live in a completely separate table. When you submit, the code is marked used in one transaction and your answers are stored in another. No column links them — no query can join a response back to who was invited.",
  },
  {
    tag: "No fingerprints",
    title: "No IP, no device, no timestamp",
    body: "We never store your IP address, browser, or the precise time you submitted — only a day bucket. Submissions can't be correlated with badge swipes, VPN logs, or login records.",
  },
  {
    tag: "Safety in numbers",
    title: "Results hidden below a threshold",
    body: "No group's results are shown until enough people respond. The minimum is set by each admin per survey, so small teams are never exposed by a single answer.",
  },
  {
    tag: "Unlinkable comments",
    title: "Free-text shown in random order",
    body: "Written comments are returned shuffled and never displayed beside a rating from the same person, so no one can reconstruct a single individual's full submission.",
  },
];

const STEPS = [
  { title: "Register", body: "Sign up with your official work email and verify your company." },
  { title: "Add people", body: "Upload your employee list by CSV or add them manually, with your reporting hierarchy." },
  { title: "Send codes", body: "Generate single-use codes per person or manager and email them in one click." },
  { title: "See insight", body: "Watch aggregated, anonymised results and download reports — never raw individuals." },
];

const FEATURES = [
  { title: "CSV or manual import", body: "Bulk-upload employees with a downloadable template, or add them by hand. Bad files get a precise error — e.g. 'missing column: email'." },
  { title: "Org hierarchy", body: "Model departments, teams and managers. Feedback rolls up the tree with the same anonymity threshold at every level." },
  { title: "Manager-wise codes", body: "Issue codes tied to a specific manager or group so feedback aggregates exactly where it belongs." },
  { title: "Email triggering", body: "Send each person their unique, single-use link straight from the dashboard. Remind non-responders without ever learning who responded." },
  { title: "Custom questionnaires", body: "Write your own questions and answer options, with weighted scoring to compute the indices you care about." },
  { title: "Configurable anonymity", body: "Set the minimum group size to reveal results per survey — not a rigid number we picked for you." },
  { title: "Validity windows", body: "Open and close surveys on a schedule; codes expire automatically when the window ends." },
  { title: "One code, one response", body: "Every link works exactly once. No double submissions, no ballot-stuffing, no spreadsheets to reconcile." },
  { title: "Report downloads", body: "Export aggregated results and comments to CSV or PDF for your leadership deck." },
];
