import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { initDoc } from '@/lib/google-sheets';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const doc = await initDoc();
    const sheet = doc.sheetsByTitle['KPI'];
    if (!sheet) throw new Error('No KPI sheet');
    
    const rows = await sheet.getRows();
    const sheetKpis = rows.map(r => r.toObject());
    
    // Delete all existing July KPIs
    await prisma.kPI.deleteMany({
      where: { month: 7, year: 2026 }
    });

    const julyKpis = sheetKpis.filter(r => r.month === '7' && r.year === '2026');
    let inserted = 0;
    
    for (const k of julyKpis) {
      await prisma.kPI.create({
        data: {
          id: k.id,
          name: k.name,
          target: parseFloat(k.target) || 0,
          current: parseFloat(k.current) || 0,
          unit: k.unit,
          month: 7,
          year: 2026,
          company: k.company,
          memberId: k.memberId,
          createdAt: k.createdAt ? new Date(k.createdAt) : new Date()
        }
      });
      inserted++;
    }

    return NextResponse.json({ success: true, message: `Replaced July KPIs with ${inserted} rows from Google Sheet.` });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message, stack: error.stack }, { status: 500 });
  }
}
