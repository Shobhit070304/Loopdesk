import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "loopdesk_session";
export type SessionUser = { sub: string; email: string; name: string; picture?: string; exp: number };

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) throw new Error("AUTH_SECRET must be set to a random value of at least 32 characters.");
  return value;
}

export function readSessionToken(value?: string | null): SessionUser | null {
  if (!value) return null;
  const [payload, signature, extra] = value.split(".");
  if (!payload || !signature || extra) return null;
  try {
    const expected = createHmac("sha256", secret()).update(payload).digest();
    const actual = Buffer.from(signature, "base64url");
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
    const user = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SessionUser;
    if (!user.sub || !user.email || !user.exp || user.exp <= Date.now() / 1000) return null;
    return user;
  } catch {
    return null;
  }
}

export function createSessionToken(user: Omit<SessionUser, "exp">, expiresInSeconds = 7 * 86400): string {
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const payloadObj: SessionUser = { ...user, exp };
  const payload = Buffer.from(JSON.stringify(payloadObj), "utf8").toString("base64url");
  const signature = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export async function getSession() {
  const cookieStore = await cookies();
  return readSessionToken(cookieStore.get(SESSION_COOKIE)?.value);
}

