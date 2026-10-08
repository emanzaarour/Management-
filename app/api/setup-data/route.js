import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../lib/auth";
import { getScopedSetupData } from "../../../lib/data";
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json(await getScopedSetupData(user));
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
