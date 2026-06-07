import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { scryptSync, randomBytes, timingSafeEqual } from "crypto";

const ORG_COOKIE = "anonvey_org";
const OWNER_COOKIE = "anonvey_owner";

function getSecret(): Uint8Array {
  const secret = process.env.ADMIN_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "ADMIN_SECRET must be set in env vars and at least 32 chars long"
    );
  }
  return new TextEncoder().encode(secret);
}

// --- password hashing (scrypt, no external dependency) ----------------------

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = (stored || "").split(":");
  if (!salt || !hash) return false;
  const hashBuf = Buffer.from(hash, "hex");
  const testBuf = scryptSync(password, salt, 64);
  return hashBuf.length === testBuf.length && timingSafeEqual(hashBuf, testBuf);
}

// --- organisation admin session --------------------------------------------

export type OrgSession = { orgId: number; adminId: number; email: string };

export async function createOrgSession(s: OrgSession): Promise<string> {
  return await new SignJWT({ ...s })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(getSecret());
}

export async function verifyOrgSession(): Promise<OrgSession | null> {
  try {
    const token = cookies().get(ORG_COOKIE)?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, getSecret());
    if (
      typeof payload.orgId !== "number" ||
      typeof payload.adminId !== "number"
    ) {
      return null;
    }
    return {
      orgId: payload.orgId,
      adminId: payload.adminId,
      email: String(payload.email || ""),
    };
  } catch {
    return null;
  }
}

// --- platform owner session (env-credential gated) -------------------------

export async function createOwnerSession(): Promise<string> {
  return await new SignJWT({ owner: true })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(getSecret());
}

export async function verifyOwnerSession(): Promise<boolean> {
  try {
    const token = cookies().get(OWNER_COOKIE)?.value;
    if (!token) return false;
    const { payload } = await jwtVerify(token, getSecret());
    return payload.owner === true;
  } catch {
    return false;
  }
}

/** Platform-owner credentials live in env (ADMIN_EMAIL + ADMIN_PASSWORD). */
export function checkOwnerCreds(email: unknown, password: unknown): boolean {
  const expectedEmail = process.env.ADMIN_EMAIL;
  const expectedPw = process.env.ADMIN_PASSWORD;
  if (!expectedEmail || !expectedPw) return false;
  if (typeof email !== "string" || typeof password !== "string") return false;
  const emailOk =
    email.trim().toLowerCase() === expectedEmail.trim().toLowerCase();
  // constant-time-ish password compare
  if (password.length !== expectedPw.length) return false;
  let diff = 0;
  for (let i = 0; i < password.length; i++) {
    diff |= password.charCodeAt(i) ^ expectedPw.charCodeAt(i);
  }
  return emailOk && diff === 0;
}

export const ORG_COOKIE_NAME = ORG_COOKIE;
export const OWNER_COOKIE_NAME = OWNER_COOKIE;
