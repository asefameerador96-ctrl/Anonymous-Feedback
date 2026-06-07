import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

// Respondent-facing: return the active managers for the organisation that owns
// the given invite token. The token determines which company's manager list
// the respondent sees, keeping organisations isolated.
export async function POST(req: NextRequest) {
  const { token } = await req.json().catch(() => ({ token: "" }));
  if (!token || typeof token !== "string") {
    return NextResponse.json({ managers: [] }, { status: 400 });
  }

  const tok = await sql`
    SELECT org_id, manager_id FROM invite_tokens WHERE token = ${token} LIMIT 1;
  `;
  if (tok.rows.length === 0 || tok.rows[0].org_id == null) {
    return NextResponse.json({ managers: [], boundManager: null, org: null });
  }
  const orgId = tok.rows[0].org_id;

  // Org branding for the survey header (name + logo).
  const orgRow = await sql`
    SELECT name, logo FROM organizations WHERE id = ${orgId} LIMIT 1;
  `;
  const org = orgRow.rows[0]
    ? { name: orgRow.rows[0].name, logo: orgRow.rows[0].logo || null }
    : null;

  // If the code is bound to a specific manager, the respondent doesn't choose —
  // return just that manager.
  if (tok.rows[0].manager_id != null) {
    const bound = await sql`
      SELECT id, name, department FROM managers
      WHERE id = ${tok.rows[0].manager_id} AND org_id = ${orgId} LIMIT 1;
    `;
    if (bound.rows.length > 0) {
      return NextResponse.json({
        managers: bound.rows,
        boundManager: bound.rows[0],
        org,
      });
    }
  }

  const { rows } = await sql`
    SELECT id, name, department FROM managers
    WHERE active = TRUE AND org_id = ${orgId}
    ORDER BY name ASC;
  `;
  return NextResponse.json({ managers: rows, boundManager: null, org });
}
