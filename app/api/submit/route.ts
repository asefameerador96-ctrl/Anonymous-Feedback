import { NextRequest, NextResponse } from "next/server";
import { sql, dayBucket } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Anonymity contract for this route:
 *  - We DO NOT log the request IP, user agent, or any header.
 *  - We mark the invite token as `used` in a SEPARATE transaction
 *    from the response insert, and we do NOT store the token alongside
 *    the response.
 *  - We store only a day bucket, not a precise timestamp.
 *  - There is no DB join possible between invite_tokens and responses.
 */
function clampRating(v: unknown): number | null {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  if (n < 1 || n > 5) return null;
  return Math.round(n);
}

function clampText(v: unknown, max = 2000): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, max);
}

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token : "";
  if (!token) {
    return NextResponse.json({ ok: false, error: "no_token" }, { status: 400 });
  }

  // STEP 1: validate and consume the token (separate from response insert).
  // We use a conditional UPDATE so the same token can't double-submit.
  // We capture org_id here so the response can be tagged to the right
  // organisation — note org_id is the ONLY thing carried over, never the token.
  const tokenResult = await sql`
    UPDATE invite_tokens
    SET used = TRUE
    WHERE token = ${token}
      AND used = FALSE
      AND expires_at > NOW()
    RETURNING org_id;
  `;
  if (tokenResult.rowCount === 0) {
    return NextResponse.json(
      { ok: false, error: "invalid_or_used_token" },
      { status: 403 }
    );
  }
  const orgId = tokenResult.rows[0].org_id ?? null;

  // STEP 2: insert the response. Note: we do NOT reference the token here.
  // From this point on, there is no path in the database from a response
  // back to the token that authorised it.
  const managerId = Number(body.manager_id);
  if (!Number.isInteger(managerId) || managerId <= 0) {
    return NextResponse.json(
      { ok: false, error: "bad_manager" },
      { status: 400 }
    );
  }

  // Ensure the chosen manager actually belongs to this organisation.
  if (orgId != null) {
    const mgr = await sql`
      SELECT 1 FROM managers WHERE id = ${managerId} AND org_id = ${orgId} LIMIT 1;
    `;
    if (mgr.rows.length === 0) {
      return NextResponse.json(
        { ok: false, error: "bad_manager" },
        { status: 400 }
      );
    }
  }

  const m_clarity = clampRating(body.manager_clarity);
  const m_support = clampRating(body.manager_support);
  const m_fairness = clampRating(body.manager_fairness);
  const m_growth = clampRating(body.manager_growth);
  const m_comments = clampText(body.manager_comments);

  const c_trust = clampRating(body.culture_trust);
  const c_inclusion = clampRating(body.culture_inclusion);
  const c_workload = clampRating(body.culture_workload);
  const c_voice = clampRating(body.culture_voice);
  const c_comments = clampText(body.culture_comments);

  const bucket = dayBucket();

  await sql`
    INSERT INTO responses (
      manager_id, org_id,
      manager_clarity, manager_support, manager_fairness, manager_growth,
      manager_comments,
      culture_trust, culture_inclusion, culture_workload, culture_voice,
      culture_comments,
      day_bucket
    ) VALUES (
      ${managerId}, ${orgId},
      ${m_clarity}, ${m_support}, ${m_fairness}, ${m_growth},
      ${m_comments},
      ${c_trust}, ${c_inclusion}, ${c_workload}, ${c_voice},
      ${c_comments},
      ${bucket}
    );
  `;

  return NextResponse.json({ ok: true });
}
