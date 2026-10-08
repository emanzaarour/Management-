import { NextResponse } from 'next/server';
import { getCurrentUser, isAdmin } from '../../../../lib/auth';
import { getSetupData, upsertSetupEntity } from '../../../../lib/data';
export async function GET() { try { const user = await getCurrentUser(); if (!user || !isAdmin(user)) return NextResponse.json({ error: 'Forbidden' }, { status: user ? 403 : 401 }); return NextResponse.json(await getSetupData()); } catch (error) { return NextResponse.json({ error: error.message }, { status: 500 }); } }
export async function POST(request) { try { const user = await getCurrentUser(); if (!user || !isAdmin(user)) return NextResponse.json({ error: 'Forbidden' }, { status: user ? 403 : 401 }); const body = await request.json(); await upsertSetupEntity({ user, entity: body.entity, rowNumber: body.rowNumber, data: body.data || {} }); return NextResponse.json({ ok: true }); } catch (error) { return NextResponse.json({ error: error.message }, { status: 400 }); } }
