import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { verifyAdminSession } from "@/lib/auth";
import crypto from "crypto";

export const dynamic = "force-dynamic";

// POST: add a new manager OR generate invite tokens, depending on `action`
export async function POST(req: NextRequest) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));

  if (body.action === "add_manager") {
    const name = String(body.name || "").trim().slice(0, 120);
    const department = String(body.department || "").trim().slice(0, 120);
    if (!name) {
      return NextResponse.json(
        { error: "name_required" },
        { status: 400 }
      );
    }
    await sql`
      INSERT INTO managers (name, department)
      VALUES (${name}, ${department || null});
    `;
    return NextResponse.json({ ok: true });
  }

  if (body.action === "generate_tokens") {
    const count = Math.min(
      Math.max(parseInt(String(body.count || "1"), 10) || 1, 1),
      500
    );
    const daysValid = Math.min(
      Math.max(parseInt(String(body.days || "30"), 10) || 30, 1),
      365
    );

    const tokens: string[] = [];
    for (let i = 0; i < count; i++) {
      tokens.push(crypto.randomBytes(16).toString("hex"));
    }

    // Bulk insert. We just stringify so we have a single SQL statement.
    const expiresAt = new Date(
      Date.now() + daysValid * 24 * 60 * 60 * 1000
    ).toISOString();

    for (const t of tokens) {
      await sql`
        INSERT INTO invite_tokens (token, expires_at)
        VALUES (${t}, ${expiresAt});
      `;
    }

    return NextResponse.json({ ok: true, tokens });
  }

  return NextResponse.json({ error: "unknown_action" }, { status: 400 });
}
