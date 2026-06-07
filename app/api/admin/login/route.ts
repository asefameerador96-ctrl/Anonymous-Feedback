import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import {
  verifyPassword,
  createOrgSession,
  ORG_COOKIE_NAME,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { email, password } = await req
    .json()
    .catch(() => ({ email: "", password: "" }));

  const cleanEmail = String(email || "").trim().toLowerCase();
  const pass = String(password || "");

  const fail = async () => {
    // Small artificial delay to slow brute force / user enumeration.
    await new Promise((r) => setTimeout(r, 500));
    return NextResponse.json({ ok: false }, { status: 401 });
  };

  if (!cleanEmail || !pass) return fail();

  const { rows } = await sql`
    SELECT id, org_id, password_hash
    FROM admins
    WHERE email = ${cleanEmail}
    LIMIT 1;
  `;
  if (rows.length === 0) return fail();

  const admin = rows[0];
  if (!verifyPassword(pass, admin.password_hash)) return fail();

  const token = await createOrgSession({
    orgId: admin.org_id,
    adminId: admin.id,
    email: cleanEmail,
  });
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

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ORG_COOKIE_NAME, "", { path: "/", maxAge: 0 });
  return res;
}
