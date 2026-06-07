import { NextRequest, NextResponse } from "next/server";
import { sql, query } from "@/lib/db";
import { verifyOrgSession } from "@/lib/auth";
import { ensureDefaultSurvey } from "@/lib/survey-db";
import crypto from "crypto";

export const dynamic = "force-dynamic";

function newToken() {
  return crypto.randomBytes(16).toString("hex");
}

// GET: this organisation's managers (including inactive), with hierarchy.
export async function GET() {
  const session = await verifyOrgSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { rows } = await sql`
    SELECT m.id, m.name, m.department, m.email, m.active, m.parent_id,
           p.name AS parent_name
    FROM managers m
    LEFT JOIN managers p ON p.id = m.parent_id
    WHERE m.org_id = ${session.orgId}
    ORDER BY m.active DESC, m.name ASC;
  `;
  return NextResponse.json({ managers: rows });
}

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
    const email = String(body.email || "").trim().toLowerCase().slice(0, 200);
    const parentId = body.parent_id ? Number(body.parent_id) : null;
    if (!name) {
      return NextResponse.json({ error: "name_required" }, { status: 400 });
    }
    await sql`
      INSERT INTO managers (name, department, email, parent_id, org_id)
      VALUES (
        ${name}, ${department || null}, ${email || null},
        ${parentId && Number.isInteger(parentId) ? parentId : null}, ${orgId}
      );
    `;
    return NextResponse.json({ ok: true });
  }

  if (body.action === "update_manager") {
    const id = Number(body.id);
    if (!Number.isInteger(id)) {
      return NextResponse.json({ error: "bad_id" }, { status: 400 });
    }
    const department = String(body.department || "").trim().slice(0, 120);
    const email = String(body.email || "").trim().toLowerCase().slice(0, 200);
    let parentId = body.parent_id ? Number(body.parent_id) : null;
    if (parentId === id) parentId = null; // a manager can't be their own parent
    await sql`
      UPDATE managers
      SET department = ${department || null},
          email = ${email || null},
          parent_id = ${parentId && Number.isInteger(parentId) ? parentId : null}
      WHERE id = ${id} AND org_id = ${orgId};
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
    // Optional manager binding (manager-wise codes).
    let managerId: number | null = body.manager_id ? Number(body.manager_id) : null;
    if (managerId != null) {
      const ok = await sql`
        SELECT 1 FROM managers WHERE id = ${managerId} AND org_id = ${orgId} LIMIT 1;
      `;
      if (ok.rows.length === 0) managerId = null;
    }

    const expiresAt = new Date(
      Date.now() + daysValid * 24 * 60 * 60 * 1000
    ).toISOString();
    const surveyId = await ensureDefaultSurvey(orgId);

    const tokens: string[] = Array.from({ length: count }, newToken);
    const placeholders: string[] = [];
    const params: any[] = [];
    tokens.forEach((t, i) => {
      const b = i * 5;
      placeholders.push(`($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5})`);
      params.push(t, expiresAt, orgId, managerId, surveyId);
    });
    await query(
      `INSERT INTO invite_tokens (token, expires_at, org_id, manager_id, survey_id) VALUES ${placeholders.join(
        ", "
      )}`,
      params
    );

    return NextResponse.json({ ok: true, tokens });
  }

  // One single-use code per employee, bound to the employee (for distribution)
  // and to their manager (for aggregation). Returns name/email so the admin can
  // mail-merge or email them their personal link.
  if (body.action === "generate_employee_tokens") {
    const daysValid = Math.min(
      Math.max(parseInt(String(body.days || "30"), 10) || 30, 1),
      365
    );
    const { rows: emps } = await sql`
      SELECT id, name, email, manager_id FROM employees WHERE org_id = ${orgId};
    `;
    if (emps.length === 0) {
      return NextResponse.json(
        { ok: false, error: "no_employees" },
        { status: 400 }
      );
    }
    const expiresAt = new Date(
      Date.now() + daysValid * 24 * 60 * 60 * 1000
    ).toISOString();
    const surveyId = await ensureDefaultSurvey(orgId);

    const out: { name: string; email: string | null; token: string }[] = [];
    const placeholders: string[] = [];
    const params: any[] = [];
    emps.forEach((e: any, i: number) => {
      const t = newToken();
      out.push({ name: e.name, email: e.email, token: t });
      const b = i * 6;
      placeholders.push(
        `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6})`
      );
      params.push(t, expiresAt, orgId, e.manager_id ?? null, e.id, surveyId);
    });
    await query(
      `INSERT INTO invite_tokens (token, expires_at, org_id, manager_id, employee_id, survey_id) VALUES ${placeholders.join(
        ", "
      )}`,
      params
    );

    return NextResponse.json({ ok: true, recipients: out });
  }

  return NextResponse.json({ error: "unknown_action" }, { status: 400 });
}
