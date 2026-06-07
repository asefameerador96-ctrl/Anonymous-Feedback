import { NextRequest, NextResponse } from "next/server";
import { sql, query } from "@/lib/db";
import { verifyOrgSession } from "@/lib/auth";
import crypto from "crypto";

export const dynamic = "force-dynamic";

// GET: list this organisation's managers (including inactive).
export async function GET() {
  const session = await verifyOrgSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { rows } = await sql`
    SELECT id, name, department, active
    FROM managers
    WHERE org_id = ${session.orgId}
    ORDER BY active DESC, name ASC;
  `;
  return NextResponse.json({ managers: rows });
}

// POST: add a manager, toggle active, set the anonymity threshold, or
// generate invite tokens — all scoped to the caller's organisation.
export async function POST(req: NextRequest) {
  const session = await verifyOrgSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const orgId = session.orgId;
  const body = await req.json().catch(() => ({}));

  if (body.action === "add_manager") {
    const name = String(body.name || "").trim().slice(0, 120);
    const department = String(body.department || "").trim().slice(0, 120);
    if (!name) {
      return NextResponse.json({ error: "name_required" }, { status: 400 });
    }
    await sql`
      INSERT INTO managers (name, department, org_id)
      VALUES (${name}, ${department || null}, ${orgId});
    `;
    return NextResponse.json({ ok: true });
  }

  if (body.action === "set_active") {
    const id = Number(body.id);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "bad_id" }, { status: 400 });
    }
    await sql`
      UPDATE managers SET active = ${Boolean(body.active)}
      WHERE id = ${id} AND org_id = ${orgId};
    `;
    return NextResponse.json({ ok: true });
  }

  if (body.action === "set_threshold") {
    const t = Number(body.threshold);
    if (!Number.isInteger(t) || t < 1 || t > 1000) {
      return NextResponse.json({ error: "bad_threshold" }, { status: 400 });
    }
    await sql`UPDATE organizations SET min_threshold = ${t} WHERE id = ${orgId};`;
    return NextResponse.json({ ok: true, threshold: t });
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

    // Single bulk insert: VALUES ($1,$2,$3),($4,$5,$6),...
    const placeholders: string[] = [];
    const params: any[] = [];
    tokens.forEach((t, i) => {
      const b = i * 3;
      placeholders.push(`($${b + 1}, $${b + 2}, $${b + 3})`);
      params.push(t, expiresAt, orgId);
    });
    await query(
      `INSERT INTO invite_tokens (token, expires_at, org_id) VALUES ${placeholders.join(
        ", "
      )}`,
      params
    );

    return NextResponse.json({ ok: true, tokens });
  }

  return NextResponse.json({ error: "unknown_action" }, { status: 400 });
}
