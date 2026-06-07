import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { verifyOrgSession } from "@/lib/auth";
import { getOrgSurvey } from "@/lib/survey-db";

export const dynamic = "force-dynamic";

function avg(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return Math.round((nums.reduce((s, n) => s + n, 0) / nums.length) * 100) / 100;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export async function GET() {
  const session = await verifyOrgSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const orgId = session.orgId;

  const orgRes = await sql`
    SELECT name, min_threshold, plan, logo FROM organizations WHERE id = ${orgId} LIMIT 1;
  `;
  if (orgRes.rows.length === 0)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const orgRow = orgRes.rows[0];
  const threshold = Number(orgRow.min_threshold) || 5;

  const data = await getOrgSurvey(orgId);
  if (!data) return NextResponse.json({ error: "no_survey" }, { status: 500 });
  const { survey, questions } = data;

  const { rows: responses } = await sql`
    SELECT manager_id, answers, score FROM survey_responses
    WHERE survey_id = ${survey.id}
    LIMIT 5000;
  `;
  const total = responses.length;
  const suppressed = total < threshold;

  // Per-question aggregation (only when above threshold).
  const comments: { question: string; text: string }[] = [];
  const questionResults = questions.map((q) => {
    const base = { id: q.id, text: q.text, type: q.type, weight: q.weight };
    if (suppressed) return { ...base, result: null };

    const raw = responses
      .map((r: any) => (r.answers ? r.answers[String(q.id)] : undefined))
      .filter((v: any) => v != null && v !== "");

    if (q.type === "scale") {
      const nums = raw.map(Number).filter((n) => n >= 1 && n <= 5);
      return { ...base, result: { kind: "scale", avg: avg(nums), count: nums.length } };
    }
    if (q.type === "nps") {
      const nums = raw.map(Number).filter((n) => n >= 0 && n <= 10);
      const prom = nums.filter((n) => n >= 9).length;
      const det = nums.filter((n) => n <= 6).length;
      const nps = nums.length ? Math.round(((prom - det) / nums.length) * 100) : null;
      return { ...base, result: { kind: "nps", avg: avg(nums), nps, count: nums.length } };
    }
    if (q.type === "single" || q.type === "multi") {
      const opts = q.options || [];
      const counts = opts.map(() => 0);
      let n = 0;
      for (const v of raw) {
        const idxs: any[] = q.type === "multi" ? (Array.isArray(v) ? v : []) : [v];
        let counted = false;
        for (const iv of idxs) {
          const i = Number(iv);
          if (Number.isInteger(i) && i >= 0 && i < counts.length) {
            counts[i]++;
            counted = true;
          }
        }
        if (counted) n++;
      }
      const distribution = opts.map((o, i) => ({
        label: o.label,
        count: counts[i],
        pct: n ? Math.round((counts[i] / n) * 100) : 0,
      }));
      return { ...base, result: { kind: "choice", distribution, count: n } };
    }
    // text
    for (const v of raw) {
      if (typeof v === "string" && v.trim())
        comments.push({ question: q.text, text: v.trim() });
    }
    return { ...base, result: { kind: "text", count: raw.length } };
  });

  // Overall weighted score (average of per-response scores).
  const scores = responses
    .map((r: any) => (r.score == null ? null : Number(r.score)))
    .filter((s: number | null): s is number => s != null);
  const overallScore = suppressed ? null : avg(scores);

  // Per-manager breakdown (overall score per manager), threshold-gated.
  let managers: any[] = [];
  if (survey.collect_manager) {
    const { rows: mgrRows } = await sql`
      SELECT id, name, department FROM managers WHERE org_id = ${orgId} AND active = TRUE ORDER BY name ASC;
    `;
    managers = mgrRows.map((m: any) => {
      const theirs = responses.filter((r: any) => r.manager_id === m.id);
      const count = theirs.length;
      const sup = count < threshold;
      const mscores = theirs
        .map((r: any) => (r.score == null ? null : Number(r.score)))
        .filter((s: number | null): s is number => s != null);
      return {
        id: m.id,
        name: m.name,
        department: m.department,
        count,
        suppressed: sup,
        score: sup ? null : avg(mscores),
      };
    });
  }

  return NextResponse.json({
    org: { name: orgRow.name, plan: orgRow.plan, logo: orgRow.logo || null },
    survey: {
      title: survey.title,
      description: survey.description,
      status: survey.status,
      collect_manager: survey.collect_manager,
    },
    threshold,
    total,
    suppressed,
    overallScore,
    questions: questionResults,
    managers,
    comments: suppressed ? [] : shuffle(comments).slice(0, 300),
  });
}
