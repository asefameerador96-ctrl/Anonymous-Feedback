import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { token } = await req.json().catch(() => ({ token: "" }));
  if (!token || typeof token !== "string") {
    return NextResponse.json({ valid: false }, { status: 400 });
  }

  const { rows } = await sql`
    SELECT used, expires_at FROM invite_tokens
    WHERE token = ${token}
    LIMIT 1;
  `;

  if (rows.length === 0) {
    return NextResponse.json({ valid: false, reason: "unknown" });
  }
  const row = rows[0];
  if (row.used) {
    return NextResponse.json({ valid: false, reason: "used" });
  }
  if (new Date(row.expires_at) < new Date()) {
    return NextResponse.json({ valid: false, reason: "expired" });
  }
  return NextResponse.json({ valid: true });
}
