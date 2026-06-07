import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { verifyOrgSession } from "@/lib/auth";
import { getOrgSurvey, ensureDefaultSurvey } from "@/lib/survey-db";
import { QuestionType } from "@/lib/survey";

export const dynamic = "force-dynamic";

const TYPES = ["scale", "nps", "single", "multi", "text"];

function cleanOptions(raw: any): string | null {
  if (!Array.isArray(raw)) return null;
  const opts = raw
    .map((o: any) => ({
      label: String(o?.label ?? "").trim().slice(0, 200),
      weight: Number(o?.weight) || 0,
    }))
    .filter((o) => o.label !== "");
  return opts.length > 0 ? JSON.stringify(opts) : null;
}

// Confirm a survey belongs to the caller's org.
async function ownsSurvey(orgId: number, surveyId: number) {
  const r = await sql`SELECT 1 FROM surveys WHERE id = ${surveyId} AND org_id = ${orgId} LIMIT 1;`;
  return r.rows.length > 0;
}
async function ownsQuestion(orgId: number, questionId: number) {
  const r = await sql`
    SELECT q.id FROM questions q JOIN surveys s ON s.id = q.survey_id
    WHERE q.id = ${questionId} AND s.org_id = ${orgId} LIMIT 1;
  `;
  return r.rows.length > 0;
}

export async function GET() {
  const session = await verifyOrgSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const data = await getOrgSurvey(session.orgId);
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const session = await verifyOrgSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const orgId = session.orgId;
  const surveyId = await ensureDefaultSurvey(orgId);
  const body = await req.json().catch(() => ({}));

  if (body.action === "update_survey") {
    const title = String(body.title || "").trim().slice(0, 200) || "Employee Survey";
    const description = String(body.description || "").trim().slice(0, 1000);
    const collectManager = Boolean(body.collect_manager);
    const status = ["active", "draft", "closed"].includes(body.status) ? body.status : "active";
    const opensAt = body.opens_at ? new Date(body.opens_at).toISOString() : null;
    const closesAt = body.closes_at ? new Date(body.closes_at).toISOString() : null;
    await sql`
      UPDATE surveys
      SET title = ${title}, description = ${description || null},
          collect_manager = ${collectManager}, status = ${status},
          opens_at = ${opensAt}, closes_at = ${closesAt}
      WHERE id = ${surveyId} AND org_id = ${orgId};
    `;
    return NextResponse.json({ ok: true });
  }

  if (body.action === "add_question") {
    const text = String(body.text || "").trim().slice(0, 500);
    if (!text) return NextResponse.json({ error: "text_required" }, { status: 400 });
    const type: QuestionType = TYPES.includes(body.type) ? body.type : "scale";
    const weight = Math.max(0, Math.min(100, Number(body.weight) || 1));
    const required = body.required !== false;
    const options = type === "single" || type === "multi" ? cleanOptions(body.options) : null;
    const posRow = await sql`SELECT COALESCE(MAX(position), -1) + 1 AS p FROM questions WHERE survey_id = ${surveyId};`;
    const position = posRow.rows[0].p;
    await sql`
      INSERT INTO questions (survey_id, position, text, type, options, weight, required)
      VALUES (${surveyId}, ${position}, ${text}, ${type}, ${options}::jsonb, ${weight}, ${required});
    `;
    return NextResponse.json({ ok: true });
  }

  if (body.action === "update_question") {
    const id = Number(body.id);
    if (!Number.isInteger(id) || !(await ownsQuestion(orgId, id))) {
      return NextResponse.json({ error: "bad_id" }, { status: 400 });
    }
    const text = String(body.text || "").trim().slice(0, 500);
    if (!text) return NextResponse.json({ error: "text_required" }, { status: 400 });
    const type: QuestionType = TYPES.includes(body.type) ? body.type : "scale";
    const weight = Math.max(0, Math.min(100, Number(body.weight) || 1));
    const required = body.required !== false;
    const options = type === "single" || type === "multi" ? cleanOptions(body.options) : null;
    await sql`
      UPDATE questions
      SET text = ${text}, type = ${type}, options = ${options}::jsonb,
          weight = ${weight}, required = ${required}
      WHERE id = ${id};
    `;
    return NextResponse.json({ ok: true });
  }

  if (body.action === "delete_question") {
    const id = Number(body.id);
    if (!Number.isInteger(id) || !(await ownsQuestion(orgId, id))) {
      return NextResponse.json({ error: "bad_id" }, { status: 400 });
    }
    await sql`DELETE FROM questions WHERE id = ${id};`;
    return NextResponse.json({ ok: true });
  }

  if (body.action === "move_question") {
    const id = Number(body.id);
    const dir = body.direction === "up" ? "up" : "down";
    if (!Number.isInteger(id) || !(await ownsQuestion(orgId, id))) {
      return NextResponse.json({ error: "bad_id" }, { status: 400 });
    }
    const all = await sql`SELECT id, position FROM questions WHERE survey_id = ${surveyId} ORDER BY position ASC, id ASC;`;
    const list = all.rows;
    const idx = list.findIndex((q: any) => q.id === id);
    const swapWith = dir === "up" ? idx - 1 : idx + 1;
    if (idx >= 0 && swapWith >= 0 && swapWith < list.length) {
      const a = list[idx];
      const b = list[swapWith];
      await sql`UPDATE questions SET position = ${b.position} WHERE id = ${a.id};`;
      await sql`UPDATE questions SET position = ${a.position} WHERE id = ${b.id};`;
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "unknown_action" }, { status: 400 });
}
