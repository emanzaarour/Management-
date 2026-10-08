import { NextResponse } from "next/server";
import {
  canAccessCenter,
  getCurrentUser,
  canReadModule,
} from "../../../lib/auth";
import { getMonthlyWorkload } from "../../../lib/data";
export async function GET(request) {
  try {
    const user = await getCurrentUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!canReadModule(user, "workload"))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const p = new URL(request.url).searchParams;
    const center = p.get("center") || user.center;
    if (!canAccessCenter(user, center))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({
      rows: await getMonthlyWorkload({
        user,
        center,
        month: Number(p.get("month")),
        year: Number(p.get("year")),
        program: p.get("program") || "All",
        teacherId: p.get("teacherId") || "All",
        section: p.get("section") || "All",
        startDate: p.get("startDate") || "",
        endDate: p.get("endDate") || "",
      }),
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
