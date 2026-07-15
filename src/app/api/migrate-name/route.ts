import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const res1 = await prisma.teamMember.updateMany({
      where: { name: 'TEW' },
      data: { name: 'TAW' }
    });
    const res2 = await prisma.teamMember.updateMany({
      where: { name: 'Tew' },
      data: { name: 'Taw' }
    });
    return NextResponse.json({ 
      success: true, 
      message: `Migrated names. TEW: ${res1.count}, Tew: ${res2.count}` 
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
