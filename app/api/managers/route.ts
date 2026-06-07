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
    SELECT org_id FROM invite_tokens WHERE token = ${token} LIMIT 1;
  `;
  if (tok.rows.length === 0 || tok.rows[0].org_id == null) {
    return NextResponse.json({ managers: [] });
  }

  const { rows } = await sql`
    SELECT id, name, department FROM managers
    WHERE active = TRUE AND org_id = ${tok.rows[0].org_id}
    ORDER BY name ASC;
  `;
  return NextResponse.json({ managers: rows });
}
