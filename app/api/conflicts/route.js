import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../lib/auth";
import { checkEntryConflict } from "../../../lib/data";
export async function POST(request) {
  try {
    const user = await getCurrentUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json(
      await checkEntryConflict({ ...(await request.json()), user }),
    );
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: error.message === "Forbidden" ? 403 : 400 },
    );
  }
}
