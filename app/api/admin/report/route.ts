import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { verifyOrgSession, OrgSession } from "@/lib/auth";
import { dayBucket } from "@/lib/db";

export const dynamic = "force-dynamic";

function csv(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET() {
  const session: OrgSession | null = await verifyOrgSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const orgId = session.orgId;

  const orgRes = await sql`
    SELECT name, min_threshold FROM organizations WHERE id = ${orgId} LIMIT 1;
  `;
  const org = orgRes.rows[0] || { name: "Organisation", min_threshold: 5 };
  const threshold = Number(org.min_threshold) || 5;

  const { rows: perManager } = await sql`
    SELECT m.name, m.department,
      COUNT(r.id)::int AS n,
      AVG(r.manager_clarity)::float AS clarity,
      AVG(r.manager_support)::float AS support,
      AVG(r.manager_fairness)::float AS fairness,
      AVG(r.manager_growth)::float AS growth
    FROM managers m
    LEFT JOIN responses r ON r.manager_id = m.id
    WHERE m.active = TRUE AND m.org_id = ${orgId}
    GROUP BY m.id, m.name, m.department
    ORDER BY m.name ASC;
  `;

  const { rows: cultureRows } = await sql`
    SELECT COUNT(*)::int AS total,
      AVG(culture_trust)::float AS trust,
      AVG(culture_inclusion)::float AS inclusion,
      AVG(culture_workload)::float AS workload,
      AVG(culture_voice)::float AS voice
    FROM responses WHERE org_id = ${orgId};
  `;
  const c = cultureRows[0];
  const cultureHidden = c.total < threshold;
  const fmt = (x: any) => (x == null ? "" : Number(x).toFixed(2));

  const lines: string[] = [];
  lines.push(`Anonvey report,${csv(org.name)}`);
  lines.push(`Generated (day),${dayBucket()}`);
  lines.push(`Minimum group size,${threshold}`);
  lines.push("");

  lines.push("Organisation-wide culture");
  lines.push("Metric,Average (/5)");
  if (cultureHidden) {
    lines.push(`Suppressed (need ${threshold} responses; have ${c.total}),`);
  } else {
    lines.push(`Trust,${fmt(c.trust)}`);
    lines.push(`Inclusion,${fmt(c.inclusion)}`);
    lines.push(`Workload,${fmt(c.workload)}`);
    lines.push(`Voice,${fmt(c.voice)}`);
  }
  lines.push(`Total responses,${c.total}`);
  lines.push("");

  lines.push("By manager");
  lines.push("Manager,Department,Responses,Clarity,Support,Fairness,Growth");
  for (const m of perManager) {
    const hidden = m.n < threshold;
    lines.push(
      [
        csv(m.name),
        csv(m.department),
        m.n,
        hidden ? "suppressed" : fmt(m.clarity),
        hidden ? "suppressed" : fmt(m.support),
        hidden ? "suppressed" : fmt(m.fairness),
        hidden ? "suppressed" : fmt(m.growth),
      ].join(",")
    );
  }
  lines.push("");

  lines.push("Comments (random order)");
  lines.push("Type,Comment");
  if (!cultureHidden) {
    const { rows: comments } = await sql`
      SELECT manager_comments, culture_comments FROM responses
      WHERE org_id = ${orgId}
        AND (manager_comments IS NOT NULL OR culture_comments IS NOT NULL)
      ORDER BY RANDOM() LIMIT 500;
    `;
    for (const cm of comments) {
      if (cm.manager_comments) lines.push(`Manager,${csv(cm.manager_comments)}`);
      if (cm.culture_comments) lines.push(`Culture,${csv(cm.culture_comments)}`);
    }
  }

  const body = lines.join("\r\n");
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="anonvey-report-${dayBucket()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
