import { NextResponse } from 'next/server';
import { getCurrentUser, isAdmin } from '../../../lib/auth';
import { getSystemSettings, updateSystemSettings } from '../../../lib/data';
export async function GET() { try { const user = await getCurrentUser(); if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); return NextResponse.json(await getSystemSettings()); } catch (error) { return NextResponse.json({ error: error.message }, { status: 500 }); } }
export async function PUT(request) { try { const user = await getCurrentUser(); if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); if (!isAdmin(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); const body = await request.json(); return NextResponse.json(await updateSystemSettings({ user, offDays: body.offDays })); } catch (error) { return NextResponse.json({ error: error.message }, { status: 400 }); } }
