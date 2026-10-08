import { NextResponse } from "next/server";
import {
  canAccessCenter,
  getCurrentUser,
  canReadModule,
} from "../../../lib/auth";
import {
  getActiveStaff,
  getStaffWithAttendanceStatus,
  canonicalCenter,
} from "../../../lib/data";
export async function GET(request) {
  try {
    const user = await getCurrentUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!canReadModule(user, "attendance"))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { searchParams } = new URL(request.url);
    const center = searchParams.get("center") || user.center;
    if (!canAccessCenter(user, center))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const month = Number(searchParams.get("month"));
    const year = Number(searchParams.get("year"));
    if (month && year)
      return NextResponse.json({
        staff: await getStaffWithAttendanceStatus({ center, month, year }),
      });
    const staff = (await getActiveStaff()).filter(
      (s) =>
        String(s.center).toLowerCase() ===
        canonicalCenter(center).toLowerCase(),
    );
    return NextResponse.json({ staff });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
