import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../lib/auth";
export async function GET() {
  try {
    const user = await getCurrentUser();
    return NextResponse.json({ user }, { status: user ? 200 : 401 });
  } catch {
    return NextResponse.json(
      { error: "Session verification is unavailable" },
      { status: 503 },
    );
  }
}
