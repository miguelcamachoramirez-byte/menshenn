import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);

  if (!session) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  return NextResponse.json({
    user: {
      id: session.userId,
      email: session.email,
      name: session.name,
      position: session.position,
      role: session.role,
    },
  });
}
