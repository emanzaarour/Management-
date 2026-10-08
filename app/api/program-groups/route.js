import { NextResponse } from "next/server";
import {
  canAccessCenter,
  canManageProgramSessions,
  getCurrentUser,
  canReadModule,
} from "../../../lib/auth";
import {
  createProgramGroup,
  getProgramGroups,
  filterGroupsForUser,
} from "../../../lib/data";
export async function GET(request) {
  try {
    const user = await getCurrentUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!canReadModule(user, "sessions"))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { searchParams } = new URL(request.url);
    const center = searchParams.get("center") || user.center;
    if (!canAccessCenter(user, center))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({
      groups: filterGroupsForUser(
        user,
        await getProgramGroups({
          center,
          program: searchParams.get("program") || "All",
          status: searchParams.get("status") || "All",
        }),
      ),
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
export async function POST(request) {
  try {
    const user = await getCurrentUser();
    if (!user || !canManageProgramSessions(user))
      return NextResponse.json(
        { error: "Forbidden" },
        { status: user ? 403 : 401 },
      );
    const body = await request.json();
    if (!canAccessCenter(user, body.center))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({
      ok: true,
      ...(await createProgramGroup({ user, group: body })),
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
