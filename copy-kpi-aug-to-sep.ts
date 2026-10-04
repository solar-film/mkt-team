import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // 1. ดึง KPI เดือนสิงหาคม (month=8) ปี 2026 ของทุกคน
  const augustKpis = await prisma.kPI.findMany({
    where: {
      month: 8,
      year: 2026,
    },
    include: {
      member: {
        select: { id: true, name: true }
      }
    }
  })

  console.log(`\n📊 พบ KPI เดือนสิงหาคม ${augustKpis.length} รายการ:`)
  for (const kpi of augustKpis) {
    console.log(`   - ${kpi.member.name}: ${kpi.name} (เป้า: ${kpi.target} ${kpi.unit})`)
  }

  if (augustKpis.length === 0) {
    console.log('\n❌ ไม่พบ KPI เดือนสิงหาคม กรุณาตรวจสอบข้อมูล')
    return
  }

  // 2. ตรวจสอบว่ามี KPI เดือนกันยายนอยู่แล้วหรือไม่
  const existingSeptKpis = await prisma.kPI.findMany({
    where: {
      month: 9,
      year: 2026,
    },
    include: {
      member: {
        select: { id: true, name: true }
      }
    }
  })

  if (existingSeptKpis.length > 0) {
    console.log(`\n⚠️  พบ KPI เดือนกันยายนอยู่แล้ว ${existingSeptKpis.length} รายการ:`)
    for (const kpi of existingSeptKpis) {
      console.log(`   - ${kpi.member.name}: ${kpi.name}`)
    }
    console.log('\n⏩ ข้ามการสร้างรายการที่มีอยู่แล้ว (ชื่อ KPI + member เดียวกัน)')
  }

  // 3. คัดลอก KPI จากเดือนสิงหาคม → กันยายน (current = 0)
  let created = 0
  let skipped = 0

  for (const kpi of augustKpis) {
    // ตรวจสอบว่ามี KPI ชื่อเดียวกันของ member เดียวกันในเดือนกันยายนแล้วหรือยัง
    const exists = existingSeptKpis.find(
      (s) => s.name === kpi.name && s.memberId === kpi.memberId
    )

    if (exists) {
      console.log(`   ⏩ ข้าม: ${kpi.member.name} - ${kpi.name} (มีอยู่แล้ว)`)
      skipped++
      continue
    }

    await prisma.kPI.create({
      data: {
        name: kpi.name,
        target: kpi.target,
        current: 0, // เริ่มต้นใหม่ที่ 0
        unit: kpi.unit,
        month: 9, // กันยายน
        year: 2026,
        company: kpi.company,
        memberId: kpi.memberId,
      }
    })
    console.log(`   ✅ สร้าง: ${kpi.member.name} - ${kpi.name} (เป้า: ${kpi.target} ${kpi.unit})`)
    created++
  }

  console.log(`\n🎉 สรุป: สร้าง KPI เดือนกันยายน ${created} รายการ, ข้าม ${skipped} รายการ`)

  // 4. แสดง KPI เดือนกันยายนทั้งหมด
  const septKpis = await prisma.kPI.findMany({
    where: {
      month: 9,
      year: 2026,
    },
    include: {
      member: {
        select: { id: true, name: true }
      }
    },
    orderBy: [
      { memberId: 'asc' },
      { name: 'asc' },
    ]
  })

  console.log(`\n📋 KPI เดือนกันยายน 2026 ทั้งหมด (${septKpis.length} รายการ):`)
  let currentMember = ''
  for (const kpi of septKpis) {
    if (kpi.member.name !== currentMember) {
      currentMember = kpi.member.name
      console.log(`\n   👤 ${currentMember}:`)
    }
    console.log(`      - ${kpi.name}: เป้า ${kpi.target} ${kpi.unit} (ปัจจุบัน: ${kpi.current})`)
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
