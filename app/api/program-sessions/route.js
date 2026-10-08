import { NextResponse } from "next/server";
import {
  canAccessCenter,
  canManageProgramSessions,
  canAccessGroup,
  getCurrentUser,
  canReadModule,
} from "../../../lib/auth";
import {
  addProgramSession,
  getProgramGroupById,
  getProgramSessions,
  updateProgramSession,
} from "../../../lib/data";

async function authorizeGroup(user, groupId) {
  const group = await getProgramGroupById(groupId);
  if (!group)
    return {
      error: NextResponse.json({ error: "Group not found." }, { status: 404 }),
    };
  if (!canAccessGroup(user, group))
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  return { group };
}

export async function GET(request) {
  try {
    const user = await getCurrentUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!canReadModule(user, "sessions"))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const groupId = new URL(request.url).searchParams.get("groupId");
    const auth = await authorizeGroup(user, groupId);
    if (auth.error) return auth.error;
    return NextResponse.json({ sessions: await getProgramSessions(groupId) });
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
    const auth = await authorizeGroup(user, body.groupId);
    if (auth.error) return auth.error;
    return NextResponse.json(
      await addProgramSession({ user, groupId: body.groupId, session: body }),
    );
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
export async function PUT(request) {
  try {
    const user = await getCurrentUser();
    if (!user || !canManageProgramSessions(user))
      return NextResponse.json(
        { error: "Forbidden" },
        { status: user ? 403 : 401 },
      );
    const body = await request.json();
    const auth = await authorizeGroup(user, body.groupId);
    if (auth.error) return auth.error;
    return NextResponse.json(
      await updateProgramSession({
        user,
        groupId: body.groupId,
        sessionNo: body.sessionNo,
        patch: body,
      }),
    );
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
