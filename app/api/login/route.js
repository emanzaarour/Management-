import { NextResponse } from 'next/server';
import { findAuthorizedUser } from '../../../lib/data';
import { makeSession, sessionCookieOptions } from '../../../lib/session';

export async function POST(request) {
  try {
    const { email } = await request.json();
    if (!email) return NextResponse.json({ error: 'Email is required.' }, { status: 400 });
    const user = await findAuthorizedUser(email);
    if (!user) return NextResponse.json({ error: 'This email is not authorized.' }, { status: 403 });
    const response = NextResponse.json({ user });
    const options = sessionCookieOptions();
    response.cookies.set(options.name, makeSession(user), options);
    return response;
  } catch (error) { return NextResponse.json({ error: error.message || 'Login failed.' }, { status: 500 }); }
}
