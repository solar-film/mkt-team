import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const includeRelations = searchParams.get('includeRelations') === 'true'

    const members = await prisma.teamMember.findMany({
      where: { id: { not: 'all' } },
      include: includeRelations ? {
        tasks: true,
        kpis: true,
        contents: true
      } : undefined
    })

    if (includeRelations) {
      const ideas = await prisma.ideaNote.findMany({
        where: { category: { in: ['task', 'content'] } }
      });
      
      const mapIdeaStatus = (s: string) => {
        if (!s || s === 'รอดำเนินการ') return 'todo';
        if (s === 'เสร็จแล้ว') return 'done';
        return 'in_progress';
      };

      ideas.forEach(idea => {
        const assignees = idea.memberId ? idea.memberId.split(',') : [];
        const boardStatus = mapIdeaStatus(idea.status);
        
        assignees.forEach(memberId => {
          const member = members.find(m => m.id === memberId);
          if (member) {
            const mappedIdea = {
              id: `idea_${idea.id}`,
              title: `💡 ${idea.title}`,
              description: idea.description,
              status: boardStatus,
              priority: idea.priority,
              startDate: null,
              deadline: idea.deadline,
              company: idea.company || 'GFS',
              link: null,
              kpiId: idea.kpiId,
              meetingId: null,
              memberId: idea.memberId,
              createdAt: idea.createdAt,
              updatedAt: idea.updatedAt,
              type: 'Idea',
              platform: idea.platform || 'General',
              publishDate: idea.deadline
            };
            
            if (idea.category === 'task' && (member as any).tasks) {
              (member as any).tasks.push(mappedIdea as any);
            } else if (idea.category === 'content' && (member as any).contents) {
              (member as any).contents.push(mappedIdea as any);
            }
          }
        });
      });
    }

    const order = ['OIL', 'TAW', 'PLENG', 'NON']
    members.sort((a, b) => {
      const indexA = order.findIndex(name => a.name.toUpperCase().includes(name));
      const indexB = order.findIndex(name => b.name.toUpperCase().includes(name));
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return a.name.localeCompare(b.name);
    })

    return NextResponse.json(members)
  } catch (error: any) {
    console.error('API Error:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch members', 
      details: error?.message || String(error) 
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, role, company, avatar, status } = body

    if (!name || !role) {
      return NextResponse.json({ error: 'Name and role are required' }, { status: 400 })
    }

    const newMember = await prisma.teamMember.create({
      data: {
        name,
        role,
        company: company || 'GFS',
        avatar: avatar || null,
        status: status || 'active'
      }
    })

    return NextResponse.json({ success: true, member: newMember })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Failed to add member' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, name, role, company, avatar, status } = body

    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 })

    const updatedMember = await prisma.teamMember.update({
      where: { id },
      data: {
        name: name !== undefined ? name : undefined,
        role: role !== undefined ? role : undefined,
        company: company !== undefined ? company : undefined,
        avatar: avatar !== undefined ? avatar : undefined,
        status: status !== undefined ? status : undefined
      }
    })

    return NextResponse.json({ success: true, member: updatedMember })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Failed to update member' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 })

    await prisma.teamMember.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Failed to delete member' }, { status: 500 })
  }
}
