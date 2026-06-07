import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { hashPassword, createOrgSession, ORG_COOKIE_NAME } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Free/personal email providers are not accepted — registration requires an
// official company domain so an organisation maps to a verifiable domain.
const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "ymail.com",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "msn.com",
  "icloud.com",
  "me.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "gmx.com",
  "mail.com",
  "yandex.com",
  "zoho.com",
  "hey.com",
]);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  const company = String(body.company_name || "").trim().slice(0, 160);
  const email = String(body.work_email || "").trim().toLowerCase().slice(0, 200);
  const phone = String(body.phone || "").trim().slice(0, 40);
  const password = String(body.password || "");
  const countRaw = Number(body.employee_count);

  const errors: Record<string, string> = {};

  if (!company) errors.company_name = "Company name is required.";

  if (!email) {
    errors.work_email = "Work email is required.";
  } else if (!EMAIL_RE.test(email)) {
    errors.work_email = "That doesn't look like a valid email address.";
  } else if (FREE_EMAIL_DOMAINS.has(email.split("@")[1])) {
    errors.work_email =
      "Please use your official company email — personal email providers (Gmail, Outlook, etc.) aren't accepted.";
  }

  if (!phone || phone.replace(/\D/g, "").length < 6) {
    errors.phone = "A valid phone number is required.";
  }

  if (!Number.isFinite(countRaw) || countRaw < 1 || countRaw > 5_000_000) {
    errors.employee_count = "Enter your employee headcount (a number ≥ 1).";
  }

  if (!password || password.length < 6) {
    errors.password = "Password must be at least 6 characters.";
  }

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ ok: false, errors }, { status: 400 });
  }

  // Reject duplicate admin email.
  const existing = await sql`SELECT id FROM admins WHERE email = ${email} LIMIT 1;`;
  if (existing.rows.length > 0) {
    return NextResponse.json(
      { ok: false, errors: { work_email: "An account with this email already exists. Sign in instead." } },
      { status: 409 }
    );
  }

  const domain = email.split("@")[1];
  const employeeCount = Math.round(countRaw);

  // Create the organisation.
  const orgRes = await sql`
    INSERT INTO organizations (name, domain, phone, employee_count)
    VALUES (${company}, ${domain}, ${phone}, ${employeeCount})
    RETURNING id;
  `;
  const orgId = orgRes.rows[0].id as number;

  // Create the admin user.
  const adminRes = await sql`
    INSERT INTO admins (org_id, email, password_hash, role)
    VALUES (${orgId}, ${email}, ${hashPassword(password)}, 'owner')
    RETURNING id;
  `;
  const adminId = adminRes.rows[0].id as number;

  // Seed a couple of example managers so the new dashboard isn't empty.
  await sql`
    INSERT INTO managers (name, department, org_id) VALUES
      ('Example Manager A', 'Engineering', ${orgId}),
      ('Example Manager B', 'Operations', ${orgId});
  `;

  // Log the new admin in.
  const token = await createOrgSession({ orgId, adminId, email });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ORG_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return res;
}
