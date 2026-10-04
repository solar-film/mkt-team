import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // ดู KPI กันยายนของ NON ปัจจุบัน
  const members = await prisma.teamMember.findMany({
    where: { name: { contains: 'NON' } },
    select: { id: true, name: true }
  })
  const non = members[0]
  
  const septKpis = await prisma.kPI.findMany({
    where: { memberId: non.id, month: 9, year: 2026 },
    orderBy: { name: 'asc' }
  })

  console.log(`📊 KPI กันยายนของ ${non.name} (${septKpis.length} รายการ):`)
  for (const kpi of septKpis) {
    console.log(`   - ${kpi.name} | เป้า: ${kpi.target} ${kpi.unit} | ปัจจุบัน: ${kpi.current} | id: ${kpi.id}`)
  }

  // เปรียบเทียบกับตุลาคม
  const octKpis = await prisma.kPI.findMany({
    where: { memberId: non.id, month: 10, year: 2026 },
    orderBy: { name: 'asc' }
  })

  console.log(`\n📋 KPI ตุลาคมของ ${non.name} (${octKpis.length} รายการ):`)
  for (const kpi of octKpis) {
    console.log(`   - ${kpi.name} | เป้า: ${kpi.target} ${kpi.unit} | ปัจจุบัน: ${kpi.current} | id: ${kpi.id}`)
  }

  // ดูทุกคนเดือนกันยายน
  const allSeptKpis = await prisma.kPI.findMany({
    where: { month: 9, year: 2026 },
    include: { member: { select: { name: true } } },
    orderBy: [{ memberId: 'asc' }, { name: 'asc' }]
  })

  console.log(`\n📋 KPI กันยายน 2026 ทุกคน (${allSeptKpis.length} รายการ):`)
  let cur = ''
  for (const kpi of allSeptKpis) {
    if (kpi.member.name !== cur) {
      cur = kpi.member.name
      console.log(`\n   👤 ${cur}:`)
    }
    console.log(`      - ${kpi.name}: เป้า ${kpi.target} ${kpi.unit} (ปัจจุบัน: ${kpi.current})`)
  }
}

main()
  .then(async () => { await prisma.$disconnect() })
  .catch(async (e) => { console.error('❌:', e); await prisma.$disconnect(); process.exit(1) })
