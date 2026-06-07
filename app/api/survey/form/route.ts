import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSurveyById, getOrgSurvey } from "@/lib/survey-db";

export const dynamic = "force-dynamic";

// Respondent-facing: given an invite code, return the survey to render — its
// questions, branding, validity, and any manager binding. Does NOT consume the
// token (that happens on submit).
export async function POST(req: NextRequest) {
  const { token } = await req.json().catch(() => ({ token: "" }));
  if (!token || typeof token !== "string") {
    return NextResponse.json({ open: false, reason: "invalid" });
  }

  const tok = await sql`
    SELECT org_id, manager_id, survey_id, used, expires_at
    FROM invite_tokens WHERE token = ${token} LIMIT 1;
  `;
  if (tok.rows.length === 0 || tok.rows[0].org_id == null) {
    return NextResponse.json({ open: false, reason: "invalid" });
  }
  const t = tok.rows[0];
  if (t.used) return NextResponse.json({ open: false, reason: "used" });
  if (new Date(t.expires_at) < new Date())
    return NextResponse.json({ open: false, reason: "expired" });

  const orgId = t.org_id as number;
  const data = t.survey_id
    ? await getSurveyById(t.survey_id)
    : await getOrgSurvey(orgId);
  if (!data) return NextResponse.json({ open: false, reason: "invalid" });

  const { survey, questions } = data;

  // Validity window / status checks.
  const now = new Date();
  if (survey.status === "closed")
    return NextResponse.json({ open: false, reason: "closed" });
  if (survey.opens_at && new Date(survey.opens_at) > now)
    return NextResponse.json({ open: false, reason: "not_open" });
  if (survey.closes_at && new Date(survey.closes_at) < now)
    return NextResponse.json({ open: false, reason: "closed" });

  // Branding.
  const orgRow = await sql`SELECT name, logo FROM organizations WHERE id = ${orgId} LIMIT 1;`;
  const org = orgRow.rows[0]
    ? { name: orgRow.rows[0].name, logo: orgRow.rows[0].logo || null }
    : null;

  // Manager binding / picker.
  let boundManager: any = null;
  let managers: any[] = [];
  if (survey.collect_manager) {
    if (t.manager_id != null) {
      const b = await sql`SELECT id, name, department FROM managers WHERE id = ${t.manager_id} AND org_id = ${orgId} LIMIT 1;`;
      if (b.rows.length > 0) boundManager = b.rows[0];
    }
    if (!boundManager) {
      const m = await sql`SELECT id, name, department FROM managers WHERE active = TRUE AND org_id = ${orgId} ORDER BY name ASC;`;
      managers = m.rows;
    }
  }

  return NextResponse.json({
    open: true,
    survey: {
      id: survey.id,
      title: survey.title,
      description: survey.description,
      collect_manager: survey.collect_manager,
    },
    questions,
    org,
    boundManager,
    managers,
  });
}
