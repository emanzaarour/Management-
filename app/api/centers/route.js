import { NextResponse } from 'next/server';
import { getCurrentUser, isAdmin } from '../../../lib/auth';
import { getCenters } from '../../../lib/data';
export async function GET() { try { const user = await getCurrentUser(); if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); if (isAdmin(user)) return NextResponse.json({ centers: await getCenters() }); return NextResponse.json({ centers: [user.center] }); } catch (error) { return NextResponse.json({ error: error.message }, { status: 500 }); } }
