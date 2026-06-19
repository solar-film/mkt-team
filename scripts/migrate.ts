import { PrismaClient } from '@prisma/client'
import { initDoc } from '../src/lib/google-sheets'

const prisma = new PrismaClient()

async function main() {
  console.log('Starting migration from Google Sheets to Supabase...')
  const doc = await initDoc()

  // 1. Migrate TeamMembers
  console.log('Migrating TeamMembers...')
  const memberSheet = doc.sheetsByTitle['TeamMember']
  const memberRows = await memberSheet.getRows()
  for (const row of memberRows) {
    await prisma.teamMember.upsert({
      where: { id: row.get('id') },
      update: {
        name: row.get('name') || '',
        role: row.get('role') || '',
        company: row.get('company') || 'GFS',
        status: row.get('status') || 'active',
        avatar: row.get('avatar') || null,
        createdAt: new Date(row.get('createdAt') || Date.now()),
      },
      create: {
        id: row.get('id'),
        name: row.get('name') || '',
        role: row.get('role') || '',
        company: row.get('company') || 'GFS',
        status: row.get('status') || 'active',
        avatar: row.get('avatar') || null,
        createdAt: new Date(row.get('createdAt') || Date.now()),
      }
    })
  }
  console.log('TeamMembers migrated.')

  // 2. Migrate Events
  console.log('Migrating Events...')
  const eventSheet = doc.sheetsByTitle['Event']
  if (eventSheet) {
    const eventRows = await eventSheet.getRows()
    for (const row of eventRows) {
      await prisma.event.upsert({
        where: { id: row.get('id') },
        update: {
          title: row.get('title') || '',
          date: new Date(row.get('date')),
          time: row.get('time') || null,
          type: row.get('type') || 'event',
          company: row.get('company') || 'GFS',
          createdAt: new Date(row.get('createdAt') || Date.now()),
        },
        create: {
          id: row.get('id'),
          title: row.get('title') || '',
          date: new Date(row.get('date')),
          time: row.get('time') || null,
          type: row.get('type') || 'event',
          company: row.get('company') || 'GFS',
          createdAt: new Date(row.get('createdAt') || Date.now()),
        }
      })
    }
    console.log('Events migrated.')
  }

  // 3. Migrate Meetings
  console.log('Migrating Meetings...')
  const meetingSheet = doc.sheetsByTitle['Meeting']
  if (meetingSheet) {
    const meetingRows = await meetingSheet.getRows()
    for (const row of meetingRows) {
      await prisma.meeting.upsert({
        where: { id: row.get('id') },
        update: {
          title: row.get('title') || '',
          date: new Date(row.get('date')),
          time: row.get('time') || null,
          company: row.get('company') || 'GFS',
          status: row.get('status') || 'upcoming',
          createdAt: new Date(row.get('createdAt') || Date.now()),
        },
        create: {
          id: row.get('id'),
          title: row.get('title') || '',
          date: new Date(row.get('date')),
          time: row.get('time') || null,
          company: row.get('company') || 'GFS',
          status: row.get('status') || 'upcoming',
          createdAt: new Date(row.get('createdAt') || Date.now()),
        }
      })
    }
    console.log('Meetings migrated.')
  }

  // 4. Migrate KPIs
  console.log('Migrating KPIs...')
  const kpiSheet = doc.sheetsByTitle['KPI']
  if (kpiSheet) {
    const kpiRows = await kpiSheet.getRows()
    for (const row of kpiRows) {
      const exists = await prisma.teamMember.findUnique({ where: { id: row.get('memberId') }})
      if (!exists) continue;

      await prisma.kPI.upsert({
        where: { id: row.get('id') },
        update: {
          name: row.get('name') || '',
          target: parseFloat(row.get('target')) || 0,
          current: parseFloat(row.get('current')) || 0,
          unit: row.get('unit') || '',
          month: parseInt(row.get('month')) || 1,
          year: parseInt(row.get('year')) || 2024,
          company: row.get('company') || 'GFS',
          memberId: row.get('memberId'),
          createdAt: new Date(row.get('createdAt') || Date.now()),
        },
        create: {
          id: row.get('id'),
          name: row.get('name') || '',
          target: parseFloat(row.get('target')) || 0,
          current: parseFloat(row.get('current')) || 0,
          unit: row.get('unit') || '',
          month: parseInt(row.get('month')) || 1,
          year: parseInt(row.get('year')) || 2024,
          company: row.get('company') || 'GFS',
          memberId: row.get('memberId'),
          createdAt: new Date(row.get('createdAt') || Date.now()),
        }
      })
    }
    console.log('KPIs migrated.')
  }

  // 5. Migrate Tasks
  console.log('Migrating Tasks...')
  const taskSheet = doc.sheetsByTitle['Task']
  if (taskSheet) {
    const taskRows = await taskSheet.getRows()
    for (const row of taskRows) {
      const exists = await prisma.teamMember.findUnique({ where: { id: row.get('memberId') }})
      if (!exists) continue;

      await prisma.task.upsert({
        where: { id: row.get('id') },
        update: {
          title: row.get('title') || '',
          description: row.get('description') || null,
          status: row.get('status') || 'todo',
          priority: row.get('priority') || 'medium',
          startDate: row.get('startDate') ? new Date(row.get('startDate')) : null,
          deadline: row.get('deadline') ? new Date(row.get('deadline')) : null,
          company: row.get('company') || 'GFS',
          link: row.get('link') || null,
          kpiId: row.get('kpiId') || null,
          meetingId: row.get('meetingId') || null,
          memberId: row.get('memberId'),
          createdAt: new Date(row.get('createdAt') || Date.now()),
        },
        create: {
          id: row.get('id'),
          title: row.get('title') || '',
          description: row.get('description') || null,
          status: row.get('status') || 'todo',
          priority: row.get('priority') || 'medium',
          startDate: row.get('startDate') ? new Date(row.get('startDate')) : null,
          deadline: row.get('deadline') ? new Date(row.get('deadline')) : null,
          company: row.get('company') || 'GFS',
          link: row.get('link') || null,
          kpiId: row.get('kpiId') || null,
          meetingId: row.get('meetingId') || null,
          memberId: row.get('memberId'),
          createdAt: new Date(row.get('createdAt') || Date.now()),
        }
      })
    }
    console.log('Tasks migrated.')
  }

  // 6. Migrate Content
  console.log('Migrating Content...')
  const contentSheet = doc.sheetsByTitle['Content']
  if (contentSheet) {
    const contentRows = await contentSheet.getRows()
    for (const row of contentRows) {
      const exists = await prisma.teamMember.findUnique({ where: { id: row.get('memberId') }})
      if (!exists) continue;

      await prisma.content.upsert({
        where: { id: row.get('id') },
        update: {
          title: row.get('title') || '',
          description: row.get('description') || null,
          type: row.get('type') || '',
          platform: row.get('platform') || '',
          company: row.get('company') || 'GFS',
          status: row.get('status') || 'draft',
          publishDate: row.get('publishDate') ? new Date(row.get('publishDate')) : null,
          link: row.get('link') || null,
          kpiId: row.get('kpiId') || null,
          memberId: row.get('memberId'),
          createdAt: new Date(row.get('createdAt') || Date.now()),
        },
        create: {
          id: row.get('id'),
          title: row.get('title') || '',
          description: row.get('description') || null,
          type: row.get('type') || '',
          platform: row.get('platform') || '',
          company: row.get('company') || 'GFS',
          status: row.get('status') || 'draft',
          publishDate: row.get('publishDate') ? new Date(row.get('publishDate')) : null,
          link: row.get('link') || null,
          kpiId: row.get('kpiId') || null,
          memberId: row.get('memberId'),
          createdAt: new Date(row.get('createdAt') || Date.now()),
        }
      })
    }
    console.log('Content migrated.')
  }

  console.log('Migration complete!')
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
