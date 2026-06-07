import { sql } from "./db";
import { DEFAULT_QUESTIONS, rowToQuestion, Question } from "./survey";

export type SurveyMeta = {
  id: number;
  org_id: number;
  title: string;
  description: string | null;
  status: string;
  collect_manager: boolean;
  opens_at: string | null;
  closes_at: string | null;
};

/** Return the org's survey id, creating a default questionnaire if none exists. */
export async function ensureDefaultSurvey(orgId: number): Promise<number> {
  const ex = await sql`
    SELECT id FROM surveys WHERE org_id = ${orgId} ORDER BY id ASC LIMIT 1;
  `;
  if (ex.rows.length > 0) return ex.rows[0].id;

  const s = await sql`
    INSERT INTO surveys (org_id, title, description)
    VALUES (${orgId}, ${"Employee Experience Survey"}, ${"Your honest, anonymous feedback."})
    RETURNING id;
  `;
  const surveyId = s.rows[0].id as number;
  for (const q of DEFAULT_QUESTIONS) {
    const opts = q.options ? JSON.stringify(q.options) : null;
    await sql`
      INSERT INTO questions (survey_id, position, text, type, options, weight, required)
      VALUES (${surveyId}, ${q.position}, ${q.text}, ${q.type}, ${opts}::jsonb, ${q.weight}, ${q.required});
    `;
  }
  return surveyId;
}

export async function getSurveyById(
  surveyId: number
): Promise<{ survey: SurveyMeta; questions: Question[] } | null> {
  const s = await sql`
    SELECT id, org_id, title, description, status, collect_manager, opens_at, closes_at
    FROM surveys WHERE id = ${surveyId} LIMIT 1;
  `;
  if (s.rows.length === 0) return null;
  const qs = await sql`
    SELECT id, position, text, type, options, weight, required
    FROM questions WHERE survey_id = ${surveyId}
    ORDER BY position ASC, id ASC;
  `;
  return {
    survey: s.rows[0] as SurveyMeta,
    questions: qs.rows.map(rowToQuestion),
  };
}

/** The org's primary survey (+ questions), creating a default if needed. */
export async function getOrgSurvey(orgId: number) {
  const id = await ensureDefaultSurvey(orgId);
  return getSurveyById(id);
}
