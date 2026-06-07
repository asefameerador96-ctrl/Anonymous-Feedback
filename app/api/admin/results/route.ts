import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { verifyOrgSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await verifyOrgSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const orgId = session.orgId;

  // Organisation context, including its configurable anonymity threshold.
  const orgRes = await sql`
    SELECT name, min_threshold, plan, logo FROM organizations WHERE id = ${orgId} LIMIT 1;
  `;
  if (orgRes.rows.length === 0) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const org = orgRes.rows[0];
  const threshold = Number(org.min_threshold) || 5;

  // Per-manager aggregates, scoped to this organisation.
  const { rows: perManager } = await sql`
    SELECT
      m.id,
      m.name,
      m.department,
      COUNT(r.id)::int AS response_count,
      AVG(r.manager_clarity)::float AS avg_clarity,
      AVG(r.manager_support)::float AS avg_support,
      AVG(r.manager_fairness)::float AS avg_fairness,
      AVG(r.manager_growth)::float AS avg_growth
    FROM managers m
    LEFT JOIN responses r ON r.manager_id = m.id
    WHERE m.active = TRUE AND m.org_id = ${orgId}
    GROUP BY m.id, m.name, m.department
    ORDER BY m.name ASC;
  `;

  const managers = perManager.map((row: any) => {
    const suppressed = row.response_count < threshold;
    return {
      id: row.id,
      name: row.name,
      department: row.department,
      response_count: row.response_count,
      suppressed,
      avg_clarity: suppressed ? null : Number(row.avg_clarity?.toFixed(2)),
      avg_support: suppressed ? null : Number(row.avg_support?.toFixed(2)),
      avg_fairness: suppressed ? null : Number(row.avg_fairness?.toFixed(2)),
      avg_growth: suppressed ? null : Number(row.avg_growth?.toFixed(2)),
    };
  });

  // Org-wide culture aggregates.
  const { rows: cultureRows } = await sql`
    SELECT
      COUNT(*)::int AS total,
      AVG(culture_trust)::float AS avg_trust,
      AVG(culture_inclusion)::float AS avg_inclusion,
      AVG(culture_workload)::float AS avg_workload,
      AVG(culture_voice)::float AS avg_voice
    FROM responses
    WHERE org_id = ${orgId};
  `;
  const c = cultureRows[0];
  const cultureSuppressed = c.total < threshold;
  const culture = {
    total: c.total,
    suppressed: cultureSuppressed,
    avg_trust: cultureSuppressed ? null : Number(c.avg_trust?.toFixed(2)),
    avg_inclusion: cultureSuppressed ? null : Number(c.avg_inclusion?.toFixed(2)),
    avg_workload: cultureSuppressed ? null : Number(c.avg_workload?.toFixed(2)),
    avg_voice: cultureSuppressed ? null : Number(c.avg_voice?.toFixed(2)),
  };

  // Comments: only above threshold, shuffled so reading order can't be matched
  // to submission order.
  let comments: { manager: string | null; culture: string | null }[] = [];
  if (!cultureSuppressed) {
    const { rows: commentRows } = await sql`
      SELECT manager_comments, culture_comments FROM responses
      WHERE org_id = ${orgId}
        AND (manager_comments IS NOT NULL OR culture_comments IS NOT NULL)
      ORDER BY RANDOM()
      LIMIT 200;
    `;
    comments = commentRows.map((r: any) => ({
      manager: r.manager_comments,
      culture: r.culture_comments,
    }));
  }

  return NextResponse.json({
    org: { name: org.name, plan: org.plan, logo: org.logo || null },
    threshold,
    managers,
    culture,
    comments,
  });
}
