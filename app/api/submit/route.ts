import { NextRequest, NextResponse } from "next/server";
import { sql, dayBucket } from "@/lib/db";
import { getSurveyById, getOrgSurvey } from "@/lib/survey-db";
import { validateAnswers, scoreResponse } from "@/lib/survey";

export const dynamic = "force-dynamic";

/**
 * Anonymity contract for this route:
 *  - We never log the request IP, user agent, or any header.
 *  - The invite token is consumed in a SEPARATE statement from the response
 *    insert, and the token is NEVER stored alongside the response.
 *  - Only org_id, survey_id and (optionally) manager_id are carried over —
 *    never the token or any employee reference.
 *  - We store only a day bucket, not a precise timestamp.
 */
export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token : "";
  if (!token) {
    return NextResponse.json({ ok: false, error: "no_token" }, { status: 400 });
  }
  const answers =
    body.answers && typeof body.answers === "object" && !Array.isArray(body.answers)
      ? body.answers
      : {};

  // STEP 1: read (don't consume yet) so a fixable validation error doesn't burn
  // the code.
  const tok = await sql`
    SELECT org_id, manager_id, survey_id FROM invite_tokens
    WHERE token = ${token} AND used = FALSE AND expires_at > NOW()
    LIMIT 1;
  `;
  if (tok.rows.length === 0 || tok.rows[0].org_id == null) {
    return NextResponse.json(
      { ok: false, error: "invalid_or_used_token" },
      { status: 403 }
    );
  }
  const orgId = tok.rows[0].org_id as number;
  const boundManagerId = tok.rows[0].manager_id ?? null;

  const data = tok.rows[0].survey_id
    ? await getSurveyById(tok.rows[0].survey_id)
    : await getOrgSurvey(orgId);
  if (!data) {
    return NextResponse.json({ ok: false, error: "no_survey" }, { status: 400 });
  }
  const { survey, questions } = data;

  // Validate answers against the questionnaire.
  const validationError = validateAnswers(questions, answers);
  if (validationError) {
    return NextResponse.json(
      { ok: false, error: "validation", message: validationError },
      { status: 400 }
    );
  }

  // Resolve manager (bound code wins; otherwise the respondent's pick).
  let managerId: number | null = null;
  if (survey.collect_manager) {
    managerId = boundManagerId != null ? Number(boundManagerId) : Number(body.manager_id);
    if (!Number.isInteger(managerId) || managerId <= 0) {
      return NextResponse.json({ ok: false, error: "bad_manager" }, { status: 400 });
    }
    const mgr = await sql`SELECT 1 FROM managers WHERE id = ${managerId} AND org_id = ${orgId} LIMIT 1;`;
    if (mgr.rows.length === 0) {
      return NextResponse.json({ ok: false, error: "bad_manager" }, { status: 400 });
    }
  }

  // STEP 2: consume the token atomically (guards against double-submit).
  const consume = await sql`
    UPDATE invite_tokens SET used = TRUE
    WHERE token = ${token} AND used = FALSE AND expires_at > NOW()
    RETURNING token;
  `;
  if (consume.rowCount === 0) {
    return NextResponse.json(
      { ok: false, error: "invalid_or_used_token" },
      { status: 403 }
    );
  }

  // STEP 3: store the de-identified response.
  const score = scoreResponse(questions, answers);
  const answersJson = JSON.stringify(answers);
  await sql`
    INSERT INTO survey_responses (survey_id, org_id, manager_id, answers, score, day_bucket)
    VALUES (${survey.id}, ${orgId}, ${managerId}, ${answersJson}::jsonb, ${score}, ${dayBucket()});
  `;

  return NextResponse.json({ ok: true });
}
