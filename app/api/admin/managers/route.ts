import { NextRequest, NextResponse } from "next/server";
import { sql, query } from "@/lib/db";
import { verifyAdminSession } from "@/lib/auth";
import crypto from "crypto";

export const dynamic = "force-dynamic";

// GET: list every manager (including inactive) for the management UI.
export async function GET() {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { rows } = await sql`
    SELECT id, name, department, active
    FROM managers
    ORDER BY active DESC, name ASC;
  `;
  return NextResponse.json({ managers: rows });
}

// POST: add a manager, toggle a manager's active flag, or generate invite
// tokens — dispatched on `action`.
export async function POST(req: NextRequest) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));

  if (body.action === "add_manager") {
    const name = String(body.name || "").trim().slice(0, 120);
    const department = String(body.department || "").trim().slice(0, 120);
    if (!name) {
      return NextResponse.json({ error: "name_required" }, { status: 400 });
    }
    await sql`
      INSERT INTO managers (name, department)
      VALUES (${name}, ${department || null});
    `;
    return NextResponse.json({ ok: true });
  }

  if (body.action === "set_active") {
    const id = Number(body.id);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "bad_id" }, { status: 400 });
    }
    const active = Boolean(body.active);
    await sql`UPDATE managers SET active = ${active} WHERE id = ${id};`;
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

    const expiresAt = new Date(
      Date.now() + daysValid * 24 * 60 * 60 * 1000
    ).toISOString();

    // Single bulk insert: VALUES ($1,$2),($3,$4),...
    const placeholders: string[] = [];
    const params: any[] = [];
    tokens.forEach((t, i) => {
      placeholders.push(`($${i * 2 + 1}, $${i * 2 + 2})`);
      params.push(t, expiresAt);
    });
    await query(
      `INSERT INTO invite_tokens (token, expires_at) VALUES ${placeholders.join(
        ", "
      )}`,
      params
    );

    return NextResponse.json({ ok: true, tokens });
  }

  return NextResponse.json({ error: "unknown_action" }, { status: 400 });
}
