import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { verifyOrgSession } from "@/lib/auth";
import { getSurveyById, ensureDefaultSurvey } from "@/lib/survey-db";
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

async function ownsSurvey(orgId: number, surveyId: number) {
  const r = await sql`SELECT 1 FROM surveys WHERE id = ${surveyId} AND org_id = ${orgId} LIMIT 1;`;
  return r.rows.length > 0;
}
async function questionSurvey(orgId: number, questionId: number): Promise<number | null> {
  const r = await sql`
    SELECT q.survey_id FROM questions q JOIN surveys s ON s.id = q.survey_id
    WHERE q.id = ${questionId} AND s.org_id = ${orgId} LIMIT 1;
  `;
  return r.rows.length ? Number(r.rows[0].survey_id) : null;
}

// GET: list of the org's surveys + the selected survey (?id=) with questions.
export async function GET(req: NextRequest) {
  const session = await verifyOrgSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const orgId = session.orgId;
  await ensureDefaultSurvey(orgId);

  const { rows: surveys } = await sql`
    SELECT s.id, s.title, s.status,
      (SELECT COUNT(*)::int FROM questions q WHERE q.survey_id = s.id) AS question_count,
      (SELECT COUNT(*)::int FROM survey_responses r WHERE r.survey_id = s.id) AS response_count
    FROM surveys s WHERE s.org_id = ${orgId} ORDER BY s.id ASC;
  `;

  const idParam = new URL(req.url).searchParams.get("id");
  let selectedId = idParam ? Number(idParam) : surveys[0]?.id;
  if (!surveys.find((s: any) => s.id === selectedId)) selectedId = surveys[0]?.id;

  const data = selectedId ? await getSurveyById(selectedId) : null;
  return NextResponse.json({
    surveys,
    survey: data?.survey || null,
    questions: data?.questions || [],
  });
}

export async function POST(req: NextRequest) {
  const session = await verifyOrgSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const orgId = session.orgId;
  const body = await req.json().catch(() => ({}));

  if (body.action === "create_survey") {
    const title = String(body.title || "").trim().slice(0, 200) || "Untitled survey";
    const r = await sql`
      INSERT INTO surveys (org_id, title, description) VALUES (${orgId}, ${title}, ${null}) RETURNING id;
    `;
    const sid = r.rows[0].id;
    // seed with one starter question so it's editable immediately
    await sql`
      INSERT INTO questions (survey_id, position, text, type, options, weight, required)
      VALUES (${sid}, 0, ${"My first question — edit me."}, 'scale', ${null}::jsonb, 1, true);
    `;
    return NextResponse.json({ ok: true, id: sid });
  }

  if (body.action === "delete_survey") {
    const id = Number(body.id);
    if (!Number.isInteger(id) || !(await ownsSurvey(orgId, id))) {
      return NextResponse.json({ error: "bad_id" }, { status: 400 });
    }
    // Keep at least one survey per org.
    const count = await sql`SELECT COUNT(*)::int AS c FROM surveys WHERE org_id = ${orgId};`;
    if (count.rows[0].c <= 1) {
      return NextResponse.json({ error: "last_survey" }, { status: 400 });
    }
    await sql`DELETE FROM survey_responses WHERE survey_id = ${id};`;
    await sql`DELETE FROM invite_tokens WHERE survey_id = ${id};`;
    await sql`DELETE FROM questions WHERE survey_id = ${id};`;
    await sql`DELETE FROM surveys WHERE id = ${id} AND org_id = ${orgId};`;
    return NextResponse.json({ ok: true });
  }

  if (body.action === "update_survey") {
    const surveyId = Number(body.survey_id);
    if (!Number.isInteger(surveyId) || !(await ownsSurvey(orgId, surveyId))) {
      return NextResponse.json({ error: "bad_id" }, { status: 400 });
    }
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
    const surveyId = Number(body.survey_id);
    if (!Number.isInteger(surveyId) || !(await ownsSurvey(orgId, surveyId))) {
      return NextResponse.json({ error: "bad_id" }, { status: 400 });
    }
    const text = String(body.text || "").trim().slice(0, 500) || "New question";
    const type: QuestionType = TYPES.includes(body.type) ? body.type : "scale";
    const weight = Math.max(0, Math.min(100, Number(body.weight) || 1));
    const required = body.required !== false;
    const options = type === "single" || type === "multi" ? cleanOptions(body.options) : null;
    const posRow = await sql`SELECT COALESCE(MAX(position), -1) + 1 AS p FROM questions WHERE survey_id = ${surveyId};`;
    await sql`
      INSERT INTO questions (survey_id, position, text, type, options, weight, required)
      VALUES (${surveyId}, ${posRow.rows[0].p}, ${text}, ${type}, ${options}::jsonb, ${weight}, ${required});
    `;
    return NextResponse.json({ ok: true });
  }

  if (body.action === "update_question") {
    const id = Number(body.id);
    if (!Number.isInteger(id) || !(await questionSurvey(orgId, id))) {
      return NextResponse.json({ error: "bad_id" }, { status: 400 });
    }
    const text = String(body.text || "").trim().slice(0, 500);
    if (!text) return NextResponse.json({ error: "text_required" }, { status: 400 });
    const type: QuestionType = TYPES.includes(body.type) ? body.type : "scale";
    const weight = Math.max(0, Math.min(100, Number(body.weight) || 1));
    const required = body.required !== false;
    const options = type === "single" || type === "multi" ? cleanOptions(body.options) : null;
    await sql`
      UPDATE questions SET text = ${text}, type = ${type}, options = ${options}::jsonb,
        weight = ${weight}, required = ${required} WHERE id = ${id};
    `;
    return NextResponse.json({ ok: true });
  }

  if (body.action === "delete_question") {
    const id = Number(body.id);
    if (!Number.isInteger(id) || !(await questionSurvey(orgId, id))) {
      return NextResponse.json({ error: "bad_id" }, { status: 400 });
    }
    await sql`DELETE FROM questions WHERE id = ${id};`;
    return NextResponse.json({ ok: true });
  }

  if (body.action === "move_question") {
    const id = Number(body.id);
    const dir = body.direction === "up" ? "up" : "down";
    const sid = await questionSurvey(orgId, id);
    if (!Number.isInteger(id) || sid == null) {
      return NextResponse.json({ error: "bad_id" }, { status: 400 });
    }
    const all = await sql`SELECT id, position FROM questions WHERE survey_id = ${sid} ORDER BY position ASC, id ASC;`;
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
