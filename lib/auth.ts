import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE_NAME = "admin_session";

function getSecret(): Uint8Array {
  const secret = process.env.ADMIN_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "ADMIN_SECRET must be set in env vars and at least 32 chars long"
    );
  }
  return new TextEncoder().encode(secret);
}

export async function createAdminSession(): Promise<string> {
  return await new SignJWT({ admin: true })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(getSecret());
}

export async function verifyAdminSession(): Promise<boolean> {
  try {
    const token = cookies().get(COOKIE_NAME)?.value;
    if (!token) return false;
    await jwtVerify(token, getSecret());
    return true;
  } catch {
    return false;
  }
}

export function checkAdminPassword(password: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  // Constant-time-ish comparison
  if (password.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < password.length; i++) {
    diff |= password.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Verify the admin login email. If ADMIN_EMAIL is not configured, the email
 * check is skipped (the dashboard stays password-only for backward
 * compatibility). Comparison is case-insensitive and whitespace-trimmed.
 */
export function checkAdminEmail(email: unknown): boolean {
  const expected = process.env.ADMIN_EMAIL;
  if (!expected) return true;
  if (typeof email !== "string") return false;
  return email.trim().toLowerCase() === expected.trim().toLowerCase();
}

export const ADMIN_COOKIE_NAME = COOKIE_NAME;
