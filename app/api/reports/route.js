import { NextResponse } from "next/server";
import {
  canAccessCenter,
  getCurrentUser,
  canReadModule,
} from "../../../lib/auth";
import { getReportsSummary } from "../../../lib/data";
export async function GET(request) {
  try {
    const user = await getCurrentUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!canReadModule(user, "reports"))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const p = new URL(request.url).searchParams;
    const center = p.get("center") || user.center;
    if (!canAccessCenter(user, center))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json(
      await getReportsSummary({
        user,
        center,
        month: Number(p.get("month")) || new Date().getUTCMonth() + 1,
        year: Number(p.get("year")) || new Date().getUTCFullYear(),
        startDate: p.get("startDate") || "",
        endDate: p.get("endDate") || "",
        teacherId: p.get("teacherId") || "All",
        program: p.get("program") || "All",
        section: p.get("section") || "All",
        subject: p.get("subject") || "All",
      }),
    );
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
