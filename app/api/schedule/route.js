import { NextResponse } from "next/server";
import {
  canAccessCenter,
  canManageWeeklySchedule,
  getCurrentUser,
  canReadModule,
} from "../../../lib/auth";
import {
  getWeeklySchedule,
  saveWeeklySchedule,
  filterScheduleForUser,
} from "../../../lib/data";
export async function GET(request) {
  try {
    const user = await getCurrentUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!canReadModule(user, "schedule"))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { searchParams } = new URL(request.url);
    const center = searchParams.get("center") || user.center;
    const weekStart = searchParams.get("weekStart");
    if (!canAccessCenter(user, center))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({
      entries: filterScheduleForUser(
        user,
        await getWeeklySchedule({ center, weekStart }),
      ),
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
export async function POST(request) {
  try {
    const user = await getCurrentUser();
    if (!user || !canManageWeeklySchedule(user))
      return NextResponse.json(
        { error: "Forbidden" },
        { status: user ? 403 : 401 },
      );
    const body = await request.json();
    const entries = body.entries || [];
    if (!entries.length) return NextResponse.json({ ok: true });
    for (const e of entries)
      if (!canAccessCenter(user, e.center))
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    await saveWeeklySchedule({ user, entries });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
