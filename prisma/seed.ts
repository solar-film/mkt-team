import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Clear existing data
  await prisma.content.deleteMany()
  await prisma.kPI.deleteMany()
  await prisma.task.deleteMany()
  await prisma.teamMember.deleteMany()

  console.log('🗑️  ล้างข้อมูลเก่าเรียบร้อย')

  // ─────────────────────────────────────────────
  // 1. สมชาย วิทยาการ - Content Manager
  // ─────────────────────────────────────────────
  const somchai = await prisma.teamMember.create({
    data: {
      name: 'สมชาย วิทยาการ',
      role: 'Content Manager',
      avatar: null,
      tasks: {
        create: [
          {
            title: 'วางแผนคอนเทนต์ประจำเดือนกรกฎาคม',
            description: 'จัดทำ Content Calendar สำหรับเดือนกรกฎาคม 2026 ทุกแพลตฟอร์ม',
            status: 'in_progress',
            priority: 'high',
            deadline: new Date('2026-06-25'),
          },
          {
            title: 'ประชุมทีมครีเอทีฟรายสัปดาห์',
            description: 'ประชุมสรุปผลงานและวางแผนงานสัปดาห์ถัดไป',
            status: 'done',
            priority: 'medium',
            deadline: new Date('2026-06-13'),
          },
          {
            title: 'รีวิว Performance Report Q2',
            description: 'วิเคราะห์ผลลัพธ์คอนเทนต์ไตรมาส 2 และจัดทำรายงาน',
            status: 'todo',
            priority: 'high',
            deadline: new Date('2026-07-05'),
          },
          {
            title: 'อัปเดต Brand Guidelines',
            description: 'ปรับปรุง Brand Guidelines ให้สอดคล้องกับแคมเปญใหม่',
            status: 'todo',
            priority: 'low',
            deadline: new Date('2026-07-15'),
          },
          {
            title: 'ตรวจสอบคอนเทนต์ก่อนเผยแพร่',
            description: 'ตรวจสอบคุณภาพคอนเทนต์ทั้งหมดก่อนเผยแพร่ในสัปดาห์นี้',
            status: 'in_progress',
            priority: 'medium',
            deadline: new Date('2026-06-15'),
          },
        ],
      },
      kpis: {
        create: [
          {
            name: 'Content Output',
            target: 20,
            current: 15,
            unit: 'ชิ้น',
            month: 6,
            year: 2026,
          },
          {
            name: 'Engagement Rate',
            target: 5,
            current: 4.2,
            unit: '%',
            month: 6,
            year: 2026,
          },
        ],
      },
      contents: {
        create: [
          {
            title: '5 เทรนด์การตลาดดิจิทัล 2026 ที่นักการตลาดต้องรู้',
            type: 'article',
            platform: 'Blog',
            status: 'published',
            publishDate: new Date('2026-06-05'),
          },
          {
            title: 'สรุปผลแคมเปญ Mid-Year Sale',
            type: 'article',
            platform: 'Blog',
            status: 'draft',
            publishDate: null,
          },
          {
            title: 'Content Strategy สำหรับ SME ฉบับเข้าใจง่าย',
            type: 'article',
            platform: 'Blog',
            status: 'published',
            publishDate: new Date('2026-06-10'),
          },
          {
            title: 'เบื้องหลังการทำงานทีมการตลาด',
            type: 'post',
            platform: 'Facebook',
            status: 'published',
            publishDate: new Date('2026-06-08'),
          },
        ],
      },
    },
  })

  console.log(`✅ สร้างข้อมูล: ${somchai.name}`)

  // ─────────────────────────────────────────────
  // 2. นภา สุขสันต์ - Social Media Specialist
  // ─────────────────────────────────────────────
  const napa = await prisma.teamMember.create({
    data: {
      name: 'นภา สุขสันต์',
      role: 'Social Media Specialist',
      avatar: null,
      tasks: {
        create: [
          {
            title: 'จัดทำ Social Media Report ประจำสัปดาห์',
            description: 'รวบรวมสถิติจากทุกแพลตฟอร์มและจัดทำรายงาน',
            status: 'done',
            priority: 'medium',
            deadline: new Date('2026-06-13'),
          },
          {
            title: 'วางแผนโพสต์ Instagram Reels',
            description: 'วางแผนและเตรียมสคริปต์สำหรับ Reels 10 คลิป',
            status: 'in_progress',
            priority: 'high',
            deadline: new Date('2026-06-20'),
          },
          {
            title: 'ตอบคอมเมนต์และ DM ลูกค้า',
            description: 'ตอบข้อความลูกค้าทุกแพลตฟอร์มภายใน 2 ชั่วโมง',
            status: 'in_progress',
            priority: 'high',
            deadline: null,
          },
          {
            title: 'เตรียมแคมเปญ LINE OA กรกฎาคม',
            description: 'ออกแบบ Rich Menu ใหม่และวางแผนข้อความ Broadcast',
            status: 'todo',
            priority: 'medium',
            deadline: new Date('2026-06-28'),
          },
        ],
      },
      kpis: {
        create: [
          {
            name: 'Followers Growth',
            target: 500,
            current: 380,
            unit: 'คน',
            month: 6,
            year: 2026,
          },
          {
            name: 'Post Reach',
            target: 10000,
            current: 8500,
            unit: 'คน',
            month: 6,
            year: 2026,
          },
          {
            name: 'Response Rate',
            target: 95,
            current: 91,
            unit: '%',
            month: 6,
            year: 2026,
          },
        ],
      },
      contents: {
        create: [
          {
            title: 'โปรโมชั่นกลางปี ลดสูงสุด 50%',
            type: 'post',
            platform: 'Facebook',
            status: 'published',
            publishDate: new Date('2026-06-01'),
          },
          {
            title: 'แนะนำสินค้าใหม่คอลเลกชันซัมเมอร์',
            type: 'post',
            platform: 'Instagram',
            status: 'published',
            publishDate: new Date('2026-06-07'),
          },
          {
            title: 'Tips & Tricks ดูแลผิวหน้าฝน',
            type: 'post',
            platform: 'LINE',
            status: 'draft',
            publishDate: null,
          },
          {
            title: 'กิจกรรมแจกของรางวัลวันสถาปนา',
            type: 'post',
            platform: 'Facebook',
            status: 'published',
            publishDate: new Date('2026-06-10'),
          },
          {
            title: 'Behind the Scenes ถ่ายแบบคอลเลกชันใหม่',
            type: 'post',
            platform: 'Instagram',
            status: 'draft',
            publishDate: null,
          },
        ],
      },
    },
  })

  console.log(`✅ สร้างข้อมูล: ${napa.name}`)

  // ─────────────────────────────────────────────
  // 3. ธนกร แสงทอง - Graphic Designer
  // ─────────────────────────────────────────────
  const thanakorn = await prisma.teamMember.create({
    data: {
      name: 'ธนกร แสงทอง',
      role: 'Graphic Designer',
      avatar: null,
      tasks: {
        create: [
          {
            title: 'ออกแบบ Banner โปรโมชั่น Mid-Year',
            description: 'ออกแบบ Banner สำหรับ Facebook, Instagram, LINE ขนาดตามที่กำหนด',
            status: 'done',
            priority: 'high',
            deadline: new Date('2026-06-10'),
          },
          {
            title: 'ออกแบบ Infographic สรุปผลิตภัณฑ์',
            description: 'สร้าง Infographic เปรียบเทียบผลิตภัณฑ์ 5 รายการ',
            status: 'in_progress',
            priority: 'medium',
            deadline: new Date('2026-06-18'),
          },
          {
            title: 'ปรับปรุง Template โพสต์ Social Media',
            description: 'อัปเดต Template ให้ตรงกับ Brand Guidelines ใหม่',
            status: 'todo',
            priority: 'low',
            deadline: new Date('2026-07-01'),
          },
          {
            title: 'ออกแบบ Packaging สินค้า Limited Edition',
            description: 'ออกแบบบรรจุภัณฑ์สินค้ารุ่น Limited Edition ฉลองครบรอบ 10 ปี',
            status: 'in_progress',
            priority: 'high',
            deadline: new Date('2026-06-22'),
          },
          {
            title: 'ออกแบบ Email Newsletter Template',
            description: 'สร้าง Template สำหรับ Email Newsletter รูปแบบใหม่',
            status: 'todo',
            priority: 'medium',
            deadline: new Date('2026-07-10'),
          },
        ],
      },
      kpis: {
        create: [
          {
            name: 'Design Output',
            target: 30,
            current: 22,
            unit: 'ชิ้น',
            month: 6,
            year: 2026,
          },
          {
            name: 'Client Satisfaction',
            target: 95,
            current: 92,
            unit: '%',
            month: 6,
            year: 2026,
          },
        ],
      },
      contents: {
        create: [
          {
            title: 'ชุดกราฟิก Mid-Year Sale 2026',
            type: 'graphic',
            platform: 'Facebook',
            status: 'published',
            publishDate: new Date('2026-06-01'),
          },
          {
            title: 'Infographic: 10 วิธีประหยัดค่าใช้จ่ายการตลาด',
            type: 'graphic',
            platform: 'Instagram',
            status: 'published',
            publishDate: new Date('2026-06-09'),
          },
          {
            title: 'ออกแบบ Carousel สินค้าขายดี Top 5',
            type: 'graphic',
            platform: 'Instagram',
            status: 'draft',
            publishDate: null,
          },
        ],
      },
    },
  })

  console.log(`✅ สร้างข้อมูล: ${thanakorn.name}`)

  // ─────────────────────────────────────────────
  // 4. พิมพ์ใจ รักดี - Content Writer
  // ─────────────────────────────────────────────
  const pimjai = await prisma.teamMember.create({
    data: {
      name: 'พิมพ์ใจ รักดี',
      role: 'Content Writer',
      avatar: null,
      tasks: {
        create: [
          {
            title: 'เขียนบทความ SEO เรื่องการตลาดออนไลน์',
            description: 'เขียนบทความ 2,000 คำ พร้อม Keyword Research',
            status: 'done',
            priority: 'high',
            deadline: new Date('2026-06-12'),
          },
          {
            title: 'เขียน Product Description สินค้าใหม่',
            description: 'เขียนรายละเอียดสินค้าใหม่ 15 รายการ',
            status: 'in_progress',
            priority: 'medium',
            deadline: new Date('2026-06-20'),
          },
          {
            title: 'รีวิวสินค้าใหม่ประจำเดือน',
            description: 'เขียนบทความรีวิวสินค้าใหม่ 3 รายการ พร้อมภาพประกอบ',
            status: 'in_progress',
            priority: 'high',
            deadline: new Date('2026-06-18'),
          },
          {
            title: 'เขียน Caption สำหรับโพสต์ Social Media',
            description: 'เขียน Caption ภาษาไทยและอังกฤษ 20 โพสต์',
            status: 'todo',
            priority: 'medium',
            deadline: new Date('2026-06-25'),
          },
        ],
      },
      kpis: {
        create: [
          {
            name: 'Articles Published',
            target: 12,
            current: 9,
            unit: 'บทความ',
            month: 6,
            year: 2026,
          },
          {
            name: 'SEO Score',
            target: 85,
            current: 78,
            unit: 'คะแนน',
            month: 6,
            year: 2026,
          },
          {
            name: 'Organic Traffic Growth',
            target: 15,
            current: 11,
            unit: '%',
            month: 6,
            year: 2026,
          },
        ],
      },
      contents: {
        create: [
          {
            title: 'คู่มือการทำ SEO สำหรับมือใหม่ 2026',
            type: 'article',
            platform: 'Blog',
            status: 'published',
            publishDate: new Date('2026-06-03'),
          },
          {
            title: 'รีวิวสินค้าใหม่ประจำเดือนมิถุนายน',
            type: 'article',
            platform: 'Blog',
            status: 'published',
            publishDate: new Date('2026-06-08'),
          },
          {
            title: '7 เครื่องมือ AI ที่ช่วยเพิ่มประสิทธิภาพการตลาด',
            type: 'article',
            platform: 'Blog',
            status: 'draft',
            publishDate: null,
          },
          {
            title: 'เปรียบเทียบแพลตฟอร์ม E-Commerce ยอดนิยม',
            type: 'article',
            platform: 'Blog',
            status: 'published',
            publishDate: new Date('2026-06-11'),
          },
          {
            title: 'วิธีเขียน Copy ให้ขายดีบน Social Media',
            type: 'post',
            platform: 'Facebook',
            status: 'draft',
            publishDate: null,
          },
        ],
      },
    },
  })

  console.log(`✅ สร้างข้อมูล: ${pimjai.name}`)

  // ─────────────────────────────────────────────
  // 5. กิตติ ชัยมงคล - Video Creator
  // ─────────────────────────────────────────────
  const kitti = await prisma.teamMember.create({
    data: {
      name: 'กิตติ ชัยมงคล',
      role: 'Video Creator',
      avatar: null,
      tasks: {
        create: [
          {
            title: 'ตัดต่อวิดีโอ Product Review',
            description: 'ตัดต่อวิดีโอรีวิวสินค้า 3 คลิป ความยาว 5-8 นาที',
            status: 'done',
            priority: 'high',
            deadline: new Date('2026-06-10'),
          },
          {
            title: 'ถ่ายทำวิดีโอ Behind the Scenes',
            description: 'ถ่ายทำวิดีโอเบื้องหลังการทำงานทีมเพื่อลง YouTube',
            status: 'in_progress',
            priority: 'medium',
            deadline: new Date('2026-06-20'),
          },
          {
            title: 'สร้าง TikTok Content 10 คลิป',
            description: 'สร้างคอนเทนต์ TikTok สั้น 15-60 วินาที จำนวน 10 คลิป',
            status: 'in_progress',
            priority: 'high',
            deadline: new Date('2026-06-22'),
          },
          {
            title: 'ถ่ายทำวิดีโอสัมภาษณ์ CEO',
            description: 'ถ่ายทำและตัดต่อวิดีโอสัมภาษณ์ CEO เรื่องวิสัยทัศน์บริษัท',
            status: 'todo',
            priority: 'high',
            deadline: new Date('2026-07-01'),
          },
          {
            title: 'เตรียม Storyboard แคมเปญใหม่',
            description: 'วาง Storyboard สำหรับวิดีโอโฆษณาแคมเปญ Q3',
            status: 'todo',
            priority: 'medium',
            deadline: new Date('2026-07-10'),
          },
        ],
      },
      kpis: {
        create: [
          {
            name: 'Videos Produced',
            target: 8,
            current: 6,
            unit: 'คลิป',
            month: 6,
            year: 2026,
          },
          {
            name: 'View Count',
            target: 50000,
            current: 42000,
            unit: 'วิว',
            month: 6,
            year: 2026,
          },
        ],
      },
      contents: {
        create: [
          {
            title: 'รีวิวสินค้าขายดีอันดับ 1 ประจำเดือน',
            type: 'video',
            platform: 'YouTube',
            status: 'published',
            publishDate: new Date('2026-06-05'),
          },
          {
            title: 'เบื้องหลังออฟฟิศ: วันธรรมดาของทีมการตลาด',
            type: 'video',
            platform: 'YouTube',
            status: 'published',
            publishDate: new Date('2026-06-12'),
          },
          {
            title: 'ลองใช้สินค้าใหม่ครั้งแรก! รีแอคชันสุดเซอร์ไพรส์',
            type: 'video',
            platform: 'TikTok',
            status: 'published',
            publishDate: new Date('2026-06-09'),
          },
          {
            title: 'สอนแต่งหน้าด้วยผลิตภัณฑ์ของเรา',
            type: 'video',
            platform: 'TikTok',
            status: 'draft',
            publishDate: null,
          },
        ],
      },
    },
  })

  console.log(`✅ สร้างข้อมูล: ${kitti.name}`)

  // Summary
  const memberCount = await prisma.teamMember.count()
  const taskCount = await prisma.task.count()
  const kpiCount = await prisma.kPI.count()
  const contentCount = await prisma.content.count()

  console.log('\n📊 สรุปข้อมูลที่สร้าง:')
  console.log(`   👥 สมาชิกทีม: ${memberCount} คน`)
  console.log(`   📋 งาน: ${taskCount} รายการ`)
  console.log(`   📈 KPI: ${kpiCount} รายการ`)
  console.log(`   📝 คอนเทนต์: ${contentCount} ชิ้น`)
}

main()
  .then(async () => {
    await prisma.$disconnect()
    console.log('\n🎉 Seed สำเร็จ!')
  })
  .catch(async (e) => {
    console.error('❌ เกิดข้อผิดพลาด:', e)
    await prisma.$disconnect()
    process.exit(1)
  })
