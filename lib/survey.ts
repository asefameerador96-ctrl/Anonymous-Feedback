/**
 * Shared survey/questionnaire logic used by the builder, the respondent flow,
 * the submit route and the results aggregation.
 *
 * Question types:
 *   scale  — 1..5 Likert
 *   nps    — 0..10 recommendation score
 *   single — pick one of N options, each option carries a weight (its "score")
 *   multi  — pick any of N options
 *   text   — free text (not scored)
 */

export type QuestionType = "scale" | "nps" | "single" | "multi" | "text";

export type Option = { label: string; weight: number };

export type Question = {
  id: number;
  position: number;
  text: string;
  type: QuestionType;
  options: Option[] | null;
  weight: number;
  required: boolean;
};

export const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: "scale", label: "Scale (1–5)" },
  { value: "nps", label: "NPS (0–10)" },
  { value: "single", label: "Single choice" },
  { value: "multi", label: "Multiple choice" },
  { value: "text", label: "Free text" },
];

export const SCALED_TYPES: QuestionType[] = ["scale", "nps", "single", "multi"];

// Default questionnaire seeded for a brand-new organisation. Mirrors the
// original manager + culture survey but is fully editable afterwards.
export const DEFAULT_QUESTIONS: Omit<Question, "id">[] = [
  { position: 0, text: "My manager sets clear expectations for my work.", type: "scale", options: null, weight: 1, required: true },
  { position: 1, text: "My manager supports me when I face obstacles.", type: "scale", options: null, weight: 1, required: true },
  { position: 2, text: "My manager treats me and my colleagues fairly.", type: "scale", options: null, weight: 1, required: true },
  { position: 3, text: "I can be myself at work without fear of judgement.", type: "scale", options: null, weight: 1, required: true },
  { position: 4, text: "When I raise concerns, they are taken seriously.", type: "scale", options: null, weight: 1, required: true },
  { position: 5, text: "How likely are you to recommend us as a place to work?", type: "nps", options: null, weight: 1, required: true },
  { position: 6, text: "Anything else you'd want leadership to truly understand?", type: "text", options: null, weight: 1, required: false },
];

function clampNum(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Normalise a single answer to 0..1, or null if not scorable / unanswered. */
export function normalizeAnswer(q: Question, answer: unknown): number | null {
  switch (q.type) {
    case "scale": {
      const n = clampNum(answer);
      if (n == null || n < 1 || n > 5) return null;
      return (n - 1) / 4;
    }
    case "nps": {
      const n = clampNum(answer);
      if (n == null || n < 0 || n > 10) return null;
      return n / 10;
    }
    case "single": {
      const idx = clampNum(answer);
      const opts = q.options || [];
      if (idx == null || idx < 0 || idx >= opts.length) return null;
      const maxW = Math.max(1, ...opts.map((o) => o.weight));
      return Math.min(1, Math.max(0, opts[idx].weight / maxW));
    }
    case "multi": {
      const arr = Array.isArray(answer) ? answer : [];
      const opts = q.options || [];
      const idxs = arr.map(clampNum).filter((n): n is number => n != null && n >= 0 && n < opts.length);
      if (idxs.length === 0) return null;
      const maxW = Math.max(1, ...opts.map((o) => o.weight));
      const avg = idxs.reduce((s, i) => s + opts[i].weight, 0) / idxs.length;
      return Math.min(1, Math.max(0, avg / maxW));
    }
    default:
      return null; // text
  }
}

/** Weighted overall score (0..100) for a response, or null if nothing scorable. */
export function scoreResponse(
  questions: Question[],
  answers: Record<string, unknown>
): number | null {
  let weighted = 0;
  let wsum = 0;
  for (const q of questions) {
    const norm = normalizeAnswer(q, answers[String(q.id)]);
    if (norm == null) continue;
    weighted += q.weight * norm;
    wsum += q.weight;
  }
  if (wsum <= 0) return null;
  return Math.round((weighted / wsum) * 1000) / 10; // one decimal place
}

/** Validate a respondent's answers. Returns an error string or null if OK. */
export function validateAnswers(
  questions: Question[],
  answers: Record<string, unknown>
): string | null {
  for (const q of questions) {
    const a = answers[String(q.id)];
    const empty =
      a == null ||
      a === "" ||
      (Array.isArray(a) && a.length === 0);
    if (q.required && empty) {
      return `Please answer: "${q.text}"`;
    }
    if (empty) continue;
    if ((q.type === "scale" || q.type === "nps" || q.type === "single") && normalizeAnswer(q, a) == null && q.type !== "single") {
      return `Invalid answer for: "${q.text}"`;
    }
  }
  return null;
}

/** Coerce a raw DB row into a typed Question (parses options JSON safely). */
export function rowToQuestion(row: any): Question {
  let options: Option[] | null = null;
  if (row.options != null) {
    try {
      const parsed = typeof row.options === "string" ? JSON.parse(row.options) : row.options;
      if (Array.isArray(parsed)) {
        options = parsed
          .map((o: any) => ({ label: String(o.label ?? ""), weight: Number(o.weight) || 0 }))
          .filter((o: Option) => o.label !== "");
      }
    } catch {
      options = null;
    }
  }
  return {
    id: Number(row.id),
    position: Number(row.position) || 0,
    text: String(row.text || ""),
    type: (["scale", "nps", "single", "multi", "text"].includes(row.type) ? row.type : "scale") as QuestionType,
    options,
    weight: Number(row.weight) || 1,
    required: row.required !== false,
  };
}
