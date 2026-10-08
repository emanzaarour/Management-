import { NextResponse } from "next/server";
import {
  canAccessCenter,
  canManageWeeklySchedule,
  getCurrentUser,
} from "../../../../lib/auth";
import { copyPreviousWeek } from "../../../../lib/data";
export async function POST(request) {
  try {
    const user = await getCurrentUser();
    if (!user || !canManageWeeklySchedule(user))
      return NextResponse.json(
        { error: "Forbidden" },
        { status: user ? 403 : 401 },
      );
    const body = await request.json();
    if (!canAccessCenter(user, body.center))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({
      ok: true,
      ...(await copyPreviousWeek({ ...body, user })),
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
