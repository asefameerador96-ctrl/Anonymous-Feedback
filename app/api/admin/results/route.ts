import { NextResponse } from "next/server";
import { sql, MIN_AGGREGATE_THRESHOLD } from "@/lib/db";
import { verifyAdminSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Per-manager aggregates. We use NULLIF/CASE so that managers with
  // fewer than MIN_AGGREGATE_THRESHOLD responses get NO numeric data back
  // (we return null and a `suppressed: true` flag instead).
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
    WHERE m.active = TRUE
    GROUP BY m.id, m.name, m.department
    ORDER BY m.name ASC;
  `;

  const managers = perManager.map((row: any) => {
    const suppressed = row.response_count < MIN_AGGREGATE_THRESHOLD;
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

  // Org-wide culture aggregates (only meaningful at scale)
  const { rows: cultureRows } = await sql`
    SELECT
      COUNT(*)::int AS total,
      AVG(culture_trust)::float AS avg_trust,
      AVG(culture_inclusion)::float AS avg_inclusion,
      AVG(culture_workload)::float AS avg_workload,
      AVG(culture_voice)::float AS avg_voice
    FROM responses;
  `;
  const c = cultureRows[0];
  const cultureSuppressed = c.total < MIN_AGGREGATE_THRESHOLD;
  const culture = {
    total: c.total,
    suppressed: cultureSuppressed,
    avg_trust: cultureSuppressed ? null : Number(c.avg_trust?.toFixed(2)),
    avg_inclusion: cultureSuppressed
      ? null
      : Number(c.avg_inclusion?.toFixed(2)),
    avg_workload: cultureSuppressed ? null : Number(c.avg_workload?.toFixed(2)),
    avg_voice: cultureSuppressed ? null : Number(c.avg_voice?.toFixed(2)),
  };

  // Comments: only return when org-wide threshold is met, and we shuffle
  // them so reading order can't be matched to submission order.
  let comments: { manager: string | null; culture: string | null }[] = [];
  if (!cultureSuppressed) {
    const { rows: commentRows } = await sql`
      SELECT manager_comments, culture_comments FROM responses
      WHERE manager_comments IS NOT NULL OR culture_comments IS NOT NULL
      ORDER BY RANDOM()
      LIMIT 200;
    `;
    comments = commentRows.map((r: any) => ({
      manager: r.manager_comments,
      culture: r.culture_comments,
    }));
  }

  return NextResponse.json({
    threshold: MIN_AGGREGATE_THRESHOLD,
    managers,
    culture,
    comments,
  });
}
