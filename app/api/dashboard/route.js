import { NextResponse } from "next/server";
import {
  canAccessCenter,
  getCurrentUser,
  isAdmin,
  canReadModule,
} from "../../../lib/auth";
import { getDashboardAnalytics } from "../../../lib/data";

export async function GET(request) {
  try {
    const user = await getCurrentUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!canReadModule(user, "dashboard"))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const p = new URL(request.url).searchParams;
    const center = p.get("center") || user.center;
    if (String(center).trim().toLowerCase() === "all") {
      if (!isAdmin(user))
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    } else if (!canAccessCenter(user, center)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json(
      await getDashboardAnalytics({
        user,
        center,
        startDate: p.get("startDate") || "",
        endDate: p.get("endDate") || "",
        teacherId: p.get("teacherId") || "All",
        program: p.get("program") || "All",
        section: p.get("section") || "All",
        subject: p.get("subject") || "All",
        referenceMonth: p.get("referenceMonth") || "",
      }),
    );
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
