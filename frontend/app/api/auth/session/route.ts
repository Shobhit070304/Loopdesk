import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ user: null }, { headers: { "Cache-Control": "no-store" } });
  const user = { sub: session.sub, email: session.email, name: session.name, picture: session.picture };
  return Response.json({ user }, { headers: { "Cache-Control": "no-store" } });
}
