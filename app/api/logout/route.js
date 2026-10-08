import { NextResponse } from 'next/server';
import { sessionCookieOptions } from '../../../lib/session';
export async function POST() { const response = NextResponse.json({ ok: true }); const options = sessionCookieOptions(); response.cookies.set(options.name, '', { ...options, maxAge: 0 }); return response; }
