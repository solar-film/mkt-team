import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // 1. ดึง KPI เดือนกันยายน (month=9) ปี 2026 ของทุกคน
  const septKpis = await prisma.kPI.findMany({
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

  console.log(`\n📊 พบ KPI เดือนกันยายน ${septKpis.length} รายการ:`)
  for (const kpi of septKpis) {
    console.log(`   - ${kpi.member.name}: ${kpi.name} (เป้า: ${kpi.target} ${kpi.unit})`)
  }

  if (septKpis.length === 0) {
    console.log('\n❌ ไม่พบ KPI เดือนกันยายน กรุณาตรวจสอบข้อมูล')
    return
  }

  // 2. ตรวจสอบว่ามี KPI เดือนตุลาคมอยู่แล้วหรือไม่
  const existingOctKpis = await prisma.kPI.findMany({
    where: {
      month: 10,
      year: 2026,
    },
    include: {
      member: {
        select: { id: true, name: true }
      }
    }
  })

  if (existingOctKpis.length > 0) {
    console.log(`\n⚠️  พบ KPI เดือนตุลาคมอยู่แล้ว ${existingOctKpis.length} รายการ`)
    console.log('⏩ ข้ามการสร้างรายการที่มีอยู่แล้ว (ชื่อ KPI + member เดียวกัน)')
  }

  // 3. คัดลอก KPI จากเดือนกันยายน → ตุลาคม (current = 0)
  let created = 0
  let skipped = 0

  for (const kpi of septKpis) {
    const exists = existingOctKpis.find(
      (o) => o.name === kpi.name && o.memberId === kpi.memberId
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
        current: 0,
        unit: kpi.unit,
        month: 10, // ตุลาคม
        year: 2026,
        company: kpi.company,
        memberId: kpi.memberId,
      }
    })
    console.log(`   ✅ สร้าง: ${kpi.member.name} - ${kpi.name} (เป้า: ${kpi.target} ${kpi.unit})`)
    created++
  }

  console.log(`\n🎉 สรุป: สร้าง KPI เดือนตุลาคม ${created} รายการ, ข้าม ${skipped} รายการ`)

  // 4. แสดง KPI เดือนตุลาคมทั้งหมด
  const octKpis = await prisma.kPI.findMany({
    where: {
      month: 10,
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

  console.log(`\n📋 KPI เดือนตุลาคม 2026 ทั้งหมด (${octKpis.length} รายการ):`)
  let currentMember = ''
  for (const kpi of octKpis) {
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
