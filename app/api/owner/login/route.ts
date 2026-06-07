import { NextRequest, NextResponse } from "next/server";
import {
  checkOwnerCreds,
  createOwnerSession,
  OWNER_COOKIE_NAME,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { email, password } = await req
    .json()
    .catch(() => ({ email: "", password: "" }));

  if (!checkOwnerCreds(email, password)) {
    await new Promise((r) => setTimeout(r, 500));
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const token = await createOwnerSession();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(OWNER_COOKIE_NAME, token, {
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
  res.cookies.set(OWNER_COOKIE_NAME, "", { path: "/", maxAge: 0 });
  return res;
}
