import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // 1. ดึง KPI กันยายนทั้ง 4 คน (ข้อมูลที่ถูกต้องตามรูปแล้ว)
  const septKpis = await prisma.kPI.findMany({
    where: { month: 9, year: 2026 },
    include: { member: { select: { id: true, name: true } } },
    orderBy: [{ memberId: 'asc' }, { name: 'asc' }]
  })

  console.log(`📊 KPI กันยายน: ${septKpis.length} รายการ`)
  let cur = ''
  for (const kpi of septKpis) {
    if (kpi.member.name !== cur) { cur = kpi.member.name; console.log(`\n   👤 ${cur}:`) }
    console.log(`      - ${kpi.name}: ${kpi.current} / ${kpi.target} ${kpi.unit}`)
  }

  // 2. ลบ KPI ตุลาคมเก่าทั้งหมด
  const deleted = await prisma.kPI.deleteMany({
    where: { month: 10, year: 2026 }
  })
  console.log(`\n🗑️  ลบ KPI ตุลาคมเก่า ${deleted.count} รายการ`)

  // 3. คัดลอกกันยายน → ตุลาคม (current = 0)
  let created = 0
  for (const kpi of septKpis) {
    await prisma.kPI.create({
      data: {
        name: kpi.name,
        target: kpi.target,
        current: 0,
        unit: kpi.unit,
        month: 10,
        year: 2026,
        company: kpi.company,
        memberId: kpi.memberId,
      }
    })
    created++
  }
  console.log(`✅ สร้าง KPI ตุลาคม ${created} รายการ`)

  // 4. แสดงผลลัพธ์
  const octKpis = await prisma.kPI.findMany({
    where: { month: 10, year: 2026 },
    include: { member: { select: { name: true } } },
    orderBy: [{ memberId: 'asc' }, { name: 'asc' }]
  })

  console.log(`\n📋 KPI ตุลาคม 2026 (${octKpis.length} รายการ):`)
  cur = ''
  for (const kpi of octKpis) {
    if (kpi.member.name !== cur) { cur = kpi.member.name; console.log(`\n   👤 ${cur}:`) }
    console.log(`      - ${kpi.name}: เป้า ${kpi.target} ${kpi.unit}`)
  }
}

main()
  .then(async () => { await prisma.$disconnect() })
  .catch(async (e) => { console.error('❌:', e); await prisma.$disconnect(); process.exit(1) })
