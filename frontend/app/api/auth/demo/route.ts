import { NextResponse } from "next/server";
import { createSessionToken, SESSION_COOKIE } from "@/lib/auth";

export async function POST() {
  const demoUser = {
    sub: "demo-operator-101",
    email: "demo@loopdesk.io",
    name: "Alex Vance",
    picture: "",
  };

  const sessionToken = createSessionToken(demoUser);
  const response = NextResponse.json({ ok: true, user: demoUser });

  response.cookies.set(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 86400,
    path: "/",
  });

  return response;
}
