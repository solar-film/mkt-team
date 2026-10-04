import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // 1. หา member NON
  const members = await prisma.teamMember.findMany({
    where: { name: { contains: 'NON' } },
    select: { id: true, name: true }
  })

  if (members.length === 0) {
    console.log('❌ ไม่พบสมาชิกชื่อ NON')
    return
  }

  const non = members[0]
  console.log(`👤 พบสมาชิก: ${non.name} (${non.id})`)

  // 2. ดู KPI กันยายนที่เหลืออยู่
  const currentSeptKpis = await prisma.kPI.findMany({
    where: { memberId: non.id, month: 9, year: 2026 }
  })
  console.log(`\n📊 KPI เดือนกันยายนปัจจุบัน: ${currentSeptKpis.length} รายการ`)
  for (const kpi of currentSeptKpis) {
    console.log(`   - ${kpi.name} (เป้า: ${kpi.target} ${kpi.unit}, ปัจจุบัน: ${kpi.current})`)
  }

  // 3. ดึง KPI ตุลาคมของ NON (คัดลอกมาจากกันยายน)
  const octKpis = await prisma.kPI.findMany({
    where: { memberId: non.id, month: 10, year: 2026 }
  })
  console.log(`\n📋 KPI เดือนตุลาคม (ต้นฉบับ): ${octKpis.length} รายการ`)

  // 4. คัดลอกกลับจากตุลาคม → กันยายน (เฉพาะที่หายไป)
  let restored = 0
  let skipped = 0

  for (const kpi of octKpis) {
    const exists = currentSeptKpis.find(
      (s) => s.name === kpi.name && s.memberId === kpi.memberId
    )

    if (exists) {
      console.log(`   ⏩ ข้าม: ${kpi.name} (ยังมีอยู่)`)
      skipped++
      continue
    }

    await prisma.kPI.create({
      data: {
        name: kpi.name,
        target: kpi.target,
        current: 0,
        unit: kpi.unit,
        month: 9, // กันยายน
        year: 2026,
        company: kpi.company,
        memberId: kpi.memberId,
      }
    })
    console.log(`   ✅ กู้คืน: ${kpi.name} (เป้า: ${kpi.target} ${kpi.unit})`)
    restored++
  }

  console.log(`\n🎉 สรุป: กู้คืน KPI กันยายนของ ${non.name} ได้ ${restored} รายการ, ข้าม ${skipped} รายการ`)

  // 5. แสดง KPI กันยายนหลังกู้คืน
  const finalSeptKpis = await prisma.kPI.findMany({
    where: { memberId: non.id, month: 9, year: 2026 },
    orderBy: { name: 'asc' }
  })
  console.log(`\n📋 KPI กันยายนของ ${non.name} หลังกู้คืน (${finalSeptKpis.length} รายการ):`)
  for (const kpi of finalSeptKpis) {
    console.log(`   - ${kpi.name}: เป้า ${kpi.target} ${kpi.unit} (ปัจจุบัน: ${kpi.current})`)
  }
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error('❌ เกิดข้อผิดพลาด:', e)
    await prisma.$disconnect()
    process.exit(1)
  })
