import { NextResponse } from "next/server";
import {
  canAccessCenter,
  getCurrentUser,
  canReadModule,
} from "../../../lib/auth";
import {
  getActiveStaff,
  getAttendanceForStaff,
  saveAttendance,
} from "../../../lib/data";
export async function GET(request) {
  try {
    const user = await getCurrentUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!canReadModule(user, "attendance"))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { searchParams } = new URL(request.url);
    const staffId = searchParams.get("staffId");
    const month = Number(searchParams.get("month"));
    const year = Number(searchParams.get("year"));
    const staff = (await getActiveStaff()).find((s) => s.id === staffId);
    if (!staff)
      return NextResponse.json(
        { error: "Staff member not found." },
        { status: 404 },
      );
    if (!canAccessCenter(user, staff.center))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({
      staff,
      attendance: await getAttendanceForStaff({ staffId, month, year }),
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
export async function POST(request) {
  try {
    const user = await getCurrentUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!canReadModule(user, "attendance"))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const body = await request.json();
    const staff = (await getActiveStaff()).find((s) => s.id === body.staffId);
    if (!staff)
      return NextResponse.json(
        { error: "Staff member not found." },
        { status: 404 },
      );
    if (!canAccessCenter(user, staff.center))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    await saveAttendance({
      user,
      staff,
      month: Number(body.month),
      year: Number(body.year),
      days: body.days || [],
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Save failed." },
      { status: 400 },
    );
  }
}
