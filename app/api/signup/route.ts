import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

// Free/personal email providers are not accepted — registration requires an
// official company domain so we can tie an organisation to a verifiable domain.
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

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  const company = String(body.company_name || "").trim().slice(0, 160);
  const email = String(body.work_email || "").trim().toLowerCase().slice(0, 200);
  const phone = String(body.phone || "").trim().slice(0, 40);
  const countRaw = Number(body.employee_count);

  const errors: Record<string, string> = {};

  if (!company) errors.company_name = "Company name is required.";

  if (!email) {
    errors.work_email = "Work email is required.";
  } else if (!EMAIL_RE.test(email)) {
    errors.work_email = "That doesn't look like a valid email address.";
  } else {
    const domain = email.split("@")[1];
    if (FREE_EMAIL_DOMAINS.has(domain)) {
      errors.work_email =
        "Please use your official company email — personal email providers (Gmail, Outlook, etc.) aren't accepted.";
    }
  }

  if (!phone || phone.replace(/\D/g, "").length < 6) {
    errors.phone = "A valid phone number is required.";
  }

  if (!Number.isFinite(countRaw) || countRaw < 1 || countRaw > 5_000_000) {
    errors.employee_count = "Enter your employee headcount (a number ≥ 1).";
  }

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ ok: false, errors }, { status: 400 });
  }

  const domain = email.split("@")[1];
  const employeeCount = Math.round(countRaw);

  await sql`
    INSERT INTO signups (company_name, work_email, email_domain, phone, employee_count)
    VALUES (${company}, ${email}, ${domain}, ${phone}, ${employeeCount});
  `;

  return NextResponse.json({ ok: true });
}
