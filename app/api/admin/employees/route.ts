import { NextRequest, NextResponse } from "next/server";
import { sql, query } from "@/lib/db";
import { verifyOrgSession } from "@/lib/auth";
import { parseCSV, validateEmployeeCsv } from "@/lib/csv";
import { ensureDefaultSurvey } from "@/lib/survey-db";
import { isEmailConfigured, sendMail, inviteEmail } from "@/lib/email";
import crypto from "crypto";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SITE = "https://anonvey.com";

export async function GET() {
  const session = await verifyOrgSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { rows } = await sql`
    SELECT e.id, e.name, e.email, e.department, e.manager_id, m.name AS manager_name
    FROM employees e
    LEFT JOIN managers m ON m.id = e.manager_id
    WHERE e.org_id = ${session.orgId}
    ORDER BY e.name ASC;
  `;
  return NextResponse.json({ employees: rows, emailConfigured: isEmailConfigured() });
}

export async function POST(req: NextRequest) {
  const session = await verifyOrgSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const orgId = session.orgId;
  const body = await req.json().catch(() => ({}));

  if (body.action === "add_employee") {
    const name = String(body.name || "").trim().slice(0, 160);
    const email = String(body.email || "").trim().toLowerCase().slice(0, 200);
    const department = String(body.department || "").trim().slice(0, 120);
    const managerId = body.manager_id ? Number(body.manager_id) : null;
    if (!name) {
      return NextResponse.json({ error: "name_required" }, { status: 400 });
    }
    if (email && !EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "bad_email" }, { status: 400 });
    }
    await sql`
      INSERT INTO employees (org_id, name, email, department, manager_id)
      VALUES (${orgId}, ${name}, ${email || null}, ${department || null}, ${
      managerId && Number.isInteger(managerId) ? managerId : null
    });
    `;
    return NextResponse.json({ ok: true });
  }

  if (body.action === "import_csv") {
    const csv = String(body.csv || "");
    if (!csv.trim()) {
      return NextResponse.json(
        { ok: false, errors: ["No file content received."] },
        { status: 400 }
      );
    }
    const result = validateEmployeeCsv(parseCSV(csv));
    if (!result.ok) {
      // Structural / row errors — import nothing, return every problem found.
      return NextResponse.json(
        { ok: false, errors: result.errors },
        { status: 400 }
      );
    }

    // Resolve manager names → ids for this org (case-insensitive).
    const { rows: mgrs } = await sql`
      SELECT id, name FROM managers WHERE org_id = ${orgId};
    `;
    const mgrByName = new Map<string, number>();
    mgrs.forEach((m: any) => mgrByName.set(String(m.name).toLowerCase(), m.id));

    const warnings: string[] = [];
    const placeholders: string[] = [];
    const params: any[] = [];
    result.employees.forEach((e, i) => {
      let managerId: number | null = null;
      if (e.manager) {
        const found = mgrByName.get(e.manager.toLowerCase());
        if (found) managerId = found;
        else
          warnings.push(
            `Manager "${e.manager}" not found — imported ${e.name} without a manager.`
          );
      }
      const b = i * 5;
      placeholders.push(
        `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5})`
      );
      params.push(orgId, e.name, e.email, e.department, managerId);
    });

    await query(
      `INSERT INTO employees (org_id, name, email, department, manager_id) VALUES ${placeholders.join(
        ", "
      )}`,
      params
    );

    return NextResponse.json({
      ok: true,
      added: result.employees.length,
      warnings,
    });
  }

  if (body.action === "delete_employee") {
    const id = Number(body.id);
    if (!Number.isInteger(id)) {
      return NextResponse.json({ error: "bad_id" }, { status: 400 });
    }
    await sql`DELETE FROM employees WHERE id = ${id} AND org_id = ${orgId};`;
    return NextResponse.json({ ok: true });
  }

  if (body.action === "clear_employees") {
    await sql`DELETE FROM employees WHERE org_id = ${orgId};`;
    return NextResponse.json({ ok: true });
  }

  // Generate a single-use code per employee (with an email) and email each
  // person their personal link. Falls back gracefully if SMTP isn't configured.
  if (body.action === "email_employee_codes") {
    if (!isEmailConfigured()) {
      return NextResponse.json(
        { ok: false, error: "email_not_configured" },
        { status: 400 }
      );
    }
    let surveyId = body.survey_id ? Number(body.survey_id) : null;
    if (surveyId != null) {
      const ok = await sql`SELECT 1 FROM surveys WHERE id = ${surveyId} AND org_id = ${orgId} LIMIT 1;`;
      if (!ok.rows.length) surveyId = null;
    }
    if (surveyId == null) surveyId = await ensureDefaultSurvey(orgId);

    const daysValid = Math.min(Math.max(parseInt(String(body.days || "30"), 10) || 30, 1), 365);
    const expiresAt = new Date(Date.now() + daysValid * 24 * 60 * 60 * 1000).toISOString();

    const { rows: emps } = await sql`
      SELECT id, name, email, manager_id FROM employees
      WHERE org_id = ${orgId} AND email IS NOT NULL AND email <> ''
      LIMIT 300;
    `;
    if (emps.length === 0) {
      return NextResponse.json({ ok: false, error: "no_emails" }, { status: 400 });
    }
    const orgRow = await sql`SELECT name FROM organizations WHERE id = ${orgId} LIMIT 1;`;
    const orgName = orgRow.rows[0]?.name || "Your organisation";

    let sent = 0;
    let failed = 0;
    for (const e of emps as any[]) {
      const token = crypto.randomBytes(16).toString("hex");
      await sql`
        INSERT INTO invite_tokens (token, expires_at, org_id, manager_id, employee_id, survey_id)
        VALUES (${token}, ${expiresAt}, ${orgId}, ${e.manager_id ?? null}, ${e.id}, ${surveyId});
      `;
      const mail = inviteEmail(orgName, `${SITE}/respond?code=${token}`);
      try {
        await sendMail({ to: e.email, subject: mail.subject, html: mail.html, text: mail.text });
        sent++;
      } catch {
        failed++;
      }
    }
    return NextResponse.json({ ok: true, sent, failed, total: emps.length });
  }

  return NextResponse.json({ error: "unknown_action" }, { status: 400 });
}
