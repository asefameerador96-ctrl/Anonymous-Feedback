import { NextRequest, NextResponse } from "next/server";
import {
  checkAdminPassword,
  createAdminSession,
  ADMIN_COOKIE_NAME,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { password } = await req.json().catch(() => ({ password: "" }));
  if (!password || !checkAdminPassword(password)) {
    // Add a small artificial delay to slow brute force
    await new Promise((r) => setTimeout(r, 500));
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const token = await createAdminSession();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE_NAME, "", { path: "/", maxAge: 0 });
  return res;
}
