import { NextResponse } from "next/server";
import { sql, dayBucket } from "@/lib/db";
import { verifyOrgSession } from "@/lib/auth";
import { getOrgSurvey } from "@/lib/survey-db";

export const dynamic = "force-dynamic";

function csv(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function avg(nums: number[]): string {
  if (nums.length === 0) return "";
  return (nums.reduce((s, n) => s + n, 0) / nums.length).toFixed(2);
}

export async function GET() {
  const session = await verifyOrgSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const orgId = session.orgId;

  const orgRes = await sql`SELECT name, min_threshold FROM organizations WHERE id = ${orgId} LIMIT 1;`;
  const org = orgRes.rows[0] || { name: "Organisation", min_threshold: 5 };
  const threshold = Number(org.min_threshold) || 5;

  const data = await getOrgSurvey(orgId);
  if (!data) return NextResponse.json({ error: "no_survey" }, { status: 500 });
  const { survey, questions } = data;

  const { rows: responses } = await sql`
    SELECT manager_id, answers, score FROM survey_responses WHERE survey_id = ${survey.id} LIMIT 5000;
  `;
  const total = responses.length;
  const hidden = total < threshold;

  const lines: string[] = [];
  lines.push(`Anonvey report,${csv(org.name)}`);
  lines.push(`Survey,${csv(survey.title)}`);
  lines.push(`Generated (day),${dayBucket()}`);
  lines.push(`Minimum group size,${threshold}`);
  lines.push(`Total responses,${total}`);
  lines.push("");

  if (hidden) {
    lines.push(`Results suppressed — need ${threshold} responses, have ${total}.`);
    return file(lines.join("\r\n"));
  }

  const scores = responses
    .map((r: any) => (r.score == null ? null : Number(r.score)))
    .filter((s: number | null): s is number => s != null);
  lines.push(`Overall weighted score (0-100),${avg(scores)}`);
  lines.push("");

  lines.push("Per question");
  lines.push("Question,Type,Weight,Metric,Value,Responses");
  for (const q of questions) {
    const raw = responses
      .map((r: any) => (r.answers ? r.answers[String(q.id)] : undefined))
      .filter((v: any) => v != null && v !== "");
    if (q.type === "scale") {
      const nums = raw.map(Number).filter((n: number) => n >= 1 && n <= 5);
      lines.push([csv(q.text), q.type, q.weight, "Average (1-5)", avg(nums), nums.length].join(","));
    } else if (q.type === "nps") {
      const nums = raw.map(Number).filter((n: number) => n >= 0 && n <= 10);
      const prom = nums.filter((n: number) => n >= 9).length;
      const det = nums.filter((n: number) => n <= 6).length;
      const nps = nums.length ? Math.round(((prom - det) / nums.length) * 100) : "";
      lines.push([csv(q.text), q.type, q.weight, "NPS", nps, nums.length].join(","));
    } else if (q.type === "single" || q.type === "multi") {
      const opts = q.options || [];
      const counts = opts.map(() => 0);
      let n = 0;
      for (const v of raw) {
        const idxs: any[] = q.type === "multi" ? (Array.isArray(v) ? v : []) : [v];
        let counted = false;
        for (const iv of idxs) {
          const i = Number(iv);
          if (Number.isInteger(i) && i >= 0 && i < counts.length) { counts[i]++; counted = true; }
        }
        if (counted) n++;
      }
      opts.forEach((o, i) => {
        lines.push([csv(q.text), q.type, q.weight, csv(`Option: ${o.label}`), counts[i], n].join(","));
      });
    } else {
      lines.push([csv(q.text), q.type, q.weight, "Free text", "", raw.length].join(","));
    }
  }
  lines.push("");

  if (survey.collect_manager) {
    const { rows: mgrs } = await sql`SELECT id, name, department FROM managers WHERE org_id = ${orgId} AND active = TRUE ORDER BY name ASC;`;
    lines.push("Per manager");
    lines.push("Manager,Department,Responses,Score (0-100)");
    for (const m of mgrs) {
      const theirs = responses.filter((r: any) => r.manager_id === m.id);
      const msc = theirs.map((r: any) => (r.score == null ? null : Number(r.score))).filter((s: any): s is number => s != null);
      const val = theirs.length < threshold ? "suppressed" : avg(msc);
      lines.push([csv(m.name), csv(m.department), theirs.length, val].join(","));
    }
    lines.push("");
  }

  lines.push("Comments (random order)");
  lines.push("Question,Comment");
  for (const q of questions) {
    if (q.type !== "text") continue;
    for (const r of responses) {
      const v = r.answers ? r.answers[String(q.id)] : null;
      if (typeof v === "string" && v.trim()) lines.push(`${csv(q.text)},${csv(v.trim())}`);
    }
  }

  return file(lines.join("\r\n"));
}

function file(body: string) {
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="anonvey-report-${dayBucket()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
