import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const members = await prisma.teamMember.findMany({
    where: { name: { contains: 'NON' } },
    select: { id: true, name: true }
  })
  const non = members[0]
  console.log(`👤 ${non.name} (${non.id})`)

  // 1. ลบ 5 รายการที่กู้คืนมาเกิน (ชื่อเก่าที่ไม่ตรงกับรูป)
  const toDelete = [
    'งานทั่วไป',
    'Facebook Reel 2 โพส /สัปดาห์',
    'บทความ 2 โพส /สัปดาห์ (Facebook)',
    'คอนเท้น 1 โพส /สัปดาห์ (Tiktok)',
    'ผลงานติดตั้ง 1-2 โพส/วัน (Facebook)',
  ]

  for (const name of toDelete) {
    const kpi = await prisma.kPI.findFirst({
      where: { memberId: non.id, month: 9, year: 2026, name }
    })
    if (kpi) {
      await prisma.kPI.delete({ where: { id: kpi.id } })
      console.log(`🗑️  ลบ: ${name}`)
    } else {
      console.log(`⏩ ไม่พบ: ${name} (อาจลบไปแล้ว)`)
    }
  }

  // 2. อัปเดตค่า current ตามรูป
  const updates = [
    { name: 'กระตุ้นยอดรีวิว Google map', current: 3 },
    { name: 'คอนเท้น 1 โพส /สัปดาห์ (Instagram)', current: 16 },
    { name: 'คอนเท้น 1 โพส /สัปดาห์ (YouTube)', current: 5 },
    { name: 'คอนเท้น 2 โพส /สัปดาห์ (Tiktok)', current: 7 },
    { name: 'บทความ 1 โพส /สัปดาห์ (Facebook)', current: 10 },
    { name: 'โปรโมชั่นประจำเดือน (Facebook)', current: 4 },
    { name: 'ผลงานติดตั้ง 1 โพส/วัน (Facebook)', current: 28 },
    { name: '*รีวิวงานติดตั้ง 1 คลิป /สัปดาห์ (Facebook)', current: 3 },
    { name: 'Facebook Reel 2-3 โพส /สัปดาห์', current: 4 },
  ]

  console.log('\n📝 อัปเดตค่า current:')
  for (const u of updates) {
    const kpi = await prisma.kPI.findFirst({
      where: { memberId: non.id, month: 9, year: 2026, name: u.name }
    })
    if (kpi) {
      await prisma.kPI.update({
        where: { id: kpi.id },
        data: { current: u.current }
      })
      console.log(`   ✅ ${u.name}: ${kpi.current} → ${u.current}`)
    } else {
      console.log(`   ❌ ไม่พบ: ${u.name}`)
    }
  }

  // 3. แสดงผลสุดท้าย
  const finalKpis = await prisma.kPI.findMany({
    where: { memberId: non.id, month: 9, year: 2026 },
    orderBy: { name: 'asc' }
  })
  console.log(`\n📋 KPI กันยายนของ ${non.name} หลังแก้ไข (${finalKpis.length} รายการ):`)
  for (const kpi of finalKpis) {
    console.log(`   - ${kpi.name}: ${kpi.current} / ${kpi.target} ${kpi.unit}`)
  }
}

main()
  .then(async () => { await prisma.$disconnect() })
  .catch(async (e) => { console.error('❌:', e); await prisma.$disconnect(); process.exit(1) })
