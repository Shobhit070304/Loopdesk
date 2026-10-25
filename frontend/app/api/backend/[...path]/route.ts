import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { readSessionToken, SESSION_COOKIE } from "@/lib/auth";

export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ path: string[] }> };

async function forward(request: NextRequest, context: RouteContext) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!readSessionToken(token)) return Response.json({ detail: "Sign in to use your workspace." }, { status: 401 });

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 20 * 1024 * 1024) {
    return Response.json({ detail: "Payload exceeds maximum allowed size (20 MB)." }, { status: 413 });
  }

  const backend = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
  const { path } = await context.params;
  const upstreamUrl = `${backend.replace(/\/$/, "")}/${path.map(encodeURIComponent).join("/")}${new URL(request.url).search}`;
  const headers = new Headers(request.headers);
  headers.delete("cookie");
  headers.delete("host");
  headers.delete("connection");
  headers.delete("content-length");
  headers.set("authorization", `Bearer ${token}`);
  const method = request.method;
  let body: ArrayBuffer | undefined = undefined;
  if (method !== "GET" && method !== "HEAD") {
    body = await request.arrayBuffer();
    if (body.byteLength > 20 * 1024 * 1024) {
      return Response.json({ detail: "Payload exceeds maximum allowed size (20 MB)." }, { status: 413 });
    }
  }
  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, { method, headers, body, cache: "no-store", redirect: "manual" });
  } catch (error) {
    console.error("Workspace API request failed", error);
    return Response.json(
      { detail: "The workspace API could not be reached. Check BACKEND_URL and confirm the API service is running." },
      { status: 502, headers: { "cache-control": "no-store" } },
    );
  }
  const responseHeaders = new Headers(upstream.headers);
  responseHeaders.delete("content-length");
  responseHeaders.delete("content-encoding");
  responseHeaders.delete("transfer-encoding");
  responseHeaders.set("cache-control", "no-store");
  return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
}

export const GET = forward;
export const POST = forward;
export const DELETE = forward;
export const PUT = forward;
export const PATCH = forward;
