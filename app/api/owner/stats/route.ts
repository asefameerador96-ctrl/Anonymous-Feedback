import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { verifyOwnerSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Manually activate / deactivate an organisation's paid plan. This is the
// "make our own billing" primitive: collect payment however you like
// (bank, bKash, invoice) then flip the org to Pro here — no payment gateway.
export async function POST(req: NextRequest) {
  if (!(await verifyOwnerSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  if (body.action === "set_plan") {
    const orgId = Number(body.orgId);
    const plan = body.plan === "pro" ? "pro" : "trial";
    if (!Number.isInteger(orgId)) {
      return NextResponse.json({ error: "bad_org" }, { status: 400 });
    }
    await sql`UPDATE organizations SET plan = ${plan} WHERE id = ${orgId};`;
    return NextResponse.json({ ok: true, plan });
  }
  return NextResponse.json({ error: "unknown_action" }, { status: 400 });
}

/**
 * Platform-owner view. Returns ONLY operational metadata — organisation
 * records, headcounts, and aggregate COUNTS. It deliberately never selects any
 * survey answer or comment content, so the owner dashboard cannot read what
 * employees said. "Even we cannot see your results" is enforced here by what
 * this query is allowed to touch.
 */
export async function GET() {
  if (!(await verifyOwnerSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { rows: orgs } = await sql`
    SELECT
      o.id,
      o.name,
      o.domain,
      o.phone,
      o.plan,
      o.employee_count,
      o.min_threshold,
      o.created_at,
      (SELECT COUNT(*)::int FROM admins a WHERE a.org_id = o.id) AS admin_count,
      (SELECT COUNT(*)::int FROM managers m WHERE m.org_id = o.id) AS manager_count,
      (SELECT COUNT(*)::int FROM invite_tokens t WHERE t.org_id = o.id) AS token_count,
      (SELECT COUNT(*)::int FROM responses r WHERE r.org_id = o.id) AS response_count
    FROM organizations o
    ORDER BY o.created_at DESC;
  `;

  const totals = {
    organizations: orgs.length,
    paid: orgs.filter((o: any) => o.plan && o.plan !== "trial").length,
    trial: orgs.filter((o: any) => !o.plan || o.plan === "trial").length,
    admins: orgs.reduce((s: number, o: any) => s + (o.admin_count || 0), 0),
    responses: orgs.reduce((s: number, o: any) => s + (o.response_count || 0), 0),
    employees: orgs.reduce((s: number, o: any) => s + (o.employee_count || 0), 0),
  };

  return NextResponse.json({ totals, organizations: orgs });
}
