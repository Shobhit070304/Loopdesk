import { NextResponse } from "next/server";
import { readSessionToken, SESSION_COOKIE } from "@/lib/auth";

export async function POST(request: Request) {
  let idToken: unknown;
  try { ({ id_token: idToken } = await request.json()); }
  catch { return NextResponse.json({ detail: "A Google ID token is required." }, { status: 400 }); }
  if (typeof idToken !== "string" || idToken.length < 50 || idToken.length > 10_000) {
    return NextResponse.json({ detail: "A valid Google ID token is required." }, { status: 400 });
  }

  const backendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
  try {
    const verified = await fetch(`${backendUrl.replace(/\/$/, "")}/auth/google/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id_token: idToken }),
      cache: "no-store",
    });
    const payload = await verified.json();
    if (!verified.ok) return NextResponse.json({ detail: payload.detail || "Google sign-in could not be verified." }, { status: verified.status });

    const sessionToken = payload.session_token;
    const session = readSessionToken(typeof sessionToken === "string" ? sessionToken : null);
    if (!session) return NextResponse.json({ detail: "The authentication service returned an invalid session." }, { status: 502 });

    const response = NextResponse.json({ user: payload.user });
    response.cookies.set(SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: Math.max(1, session.exp - Math.floor(Date.now() / 1000)),
      path: "/",
    });
    return response;
  } catch {
    return NextResponse.json({ detail: "The authentication service is unavailable. Please try again." }, { status: 502 });
  }
}
