// Business-structure reference page (/company). Only information the team already shares
// with customers lives here: this repository is public and the site has no password, so
// sales figures, targets, ad budgets/spend and ad account ids are deliberately left out.

export const STRUCTURE_AS_OF = '23 ต.ค. 69';

export type LogoKey = 'gfs' | 'mhl' | 'car';
export type BusinessKey = 'b2b' | 'b2c' | 'mhl' | 'car';

export const LOGOS: Record<LogoKey, { src: string; alt: string; background: string; width: number; height: number }> = {
  gfs: { src: '/brands/goodfilm.webp', alt: 'โลโก้ GOODFILM', background: '#1b437c', width: 192, height: 80 },
  mhl: { src: '/brands/maholan.webp', alt: 'โลโก้ Maholan Film', background: '#ffffff', width: 188, height: 80 },
  car: { src: '/brands/mhl-carfilm.webp', alt: 'โลโก้ MHL CARFILM', background: '#000000', width: 288, height: 96 },
};

export interface Business {
  key: BusinessKey;
  name: string;
  short: string;
  summary: string;
  aim: string;
  logo: LogoKey;
  color: string;
  soft: string;
  company: string;
  owner: string;
  websiteCount: number;
  /** Phone + LINE OA + email confirmed by the owner (social accounts not counted yet). */
  channelCount: number;
  info: [string, string][];
  websites: string[];
  wholesalePages?: [string, string][];
  channels: string[];
  socials: string[];
  people: string[];
}

const GFS_INFO: [string, string][] = [
  ['ที่อยู่', '914/10-11 ถ.ลาซาล แขวงบางนา เขตบางนา กรุงเทพฯ 10260'],
  ['เลขผู้เสียภาษี', '0105554060900'],
  ['เวลาทำการ', 'จ.–ส. 08:00–17:00'],
];
const GFS_EMAILS = ['goodfilmshop@gmail.com', 'info@goodfilmshop.com', 'crm@goodfilmshop.com'];

export const BUSINESSES: Business[] = [
  {
    key: 'b2b', name: 'GFS B2B', short: 'ขายส่ง 3M ยกม้วน', summary: 'ขายส่งฟิล์มอาคาร 3M ยกม้วน',
    aim: 'ขายส่งฟิล์มอาคาร 3M ยกม้วน ให้ช่างติดตั้ง ผู้รับเหมา ร้านอลูมิเนียม-ม่าน และสถาปนิก',
    logo: 'gfs', color: '#1b437c', soft: '#e6edf7', company: 'บริษัท กู๊ดฟิล์ม จำกัด (สำนักงานใหญ่)',
    owner: 'แต้ว', websiteCount: 2, channelCount: 5, info: GFS_INFO,
    websites: ['3m-goodfilm.com', 'goodfilm.co.th · มีแผนพัฒนา'],
    wholesalePages: [
      ['หน้าแลนดิ้งแอด', 'goodfilmshop.com/ฟิล์ม-3M-ยกม้วน'],
      ['ลงทะเบียนขอราคาส่ง', 'goodfilm-price.pages.dev/register · ลูกค้ากรอกฟอร์ม แล้วรอทีมโทรกลับ (ไม่โชว์ราคา)'],
    ],
    channels: ['โทร 092-905-8519 (เฮียปอ)', 'LINE @3mfilm · lin.ee/646JMY6', ...GFS_EMAILS],
    socials: ['Facebook: facebook.com/3MGoodfilm', 'Instagram: @goodfilm.shop (ใช้ร่วมกับ B2C)', 'YouTube: youtube.com/@goodfilm3M (ใช้ร่วมกับ B2C)'],
    people: ['แต้ว (TAW) · ผู้ดูแล', 'เฮียปอ · รับลีดขายส่ง'],
  },
  {
    key: 'b2c', name: 'GFS B2C', short: 'ฟิล์มบ้าน/อาคาร', summary: 'ฟิล์มบ้านและอาคาร GOODFILM',
    aim: 'ขายและติดตั้งฟิล์มอาคาร 3M ในฐานะตัวแทนอย่างเป็นทางการ ให้บ้าน คอนโด สำนักงาน ทั่วประเทศ',
    logo: 'gfs', color: '#034aad', soft: '#e3eeff', company: 'บริษัท กู๊ดฟิล์ม จำกัด (สำนักงานใหญ่)',
    owner: 'จ๋าย', websiteCount: 1, channelCount: 8, info: GFS_INFO,
    websites: ['goodfilmshop.com'],
    channels: ['Call Center 02-096-3424', 'มือถือ 097-097-2103', '062-747-1234 · 090-979-3760', 'LINE @goodfilm · lin.ee/Xwo0pdm', ...GFS_EMAILS],
    socials: ['Facebook: facebook.com/goodfilm3M', 'Instagram: @goodfilm.shop', 'TikTok: @goodfilm3m', 'YouTube: youtube.com/@goodfilm3M'],
    people: ['จ๋าย · ผู้ดูแลคอนเทนต์', 'แต้ว · ช่วยอนุมัติงานจ๋าย'],
  },
  {
    key: 'mhl', name: 'MHL อาคาร', short: 'ติดตั้งฟิล์มอาคาร', summary: 'ติดตั้งฟิล์มอาคาร มโหฬารฟิล์ม',
    aim: 'รับติดฟิล์มกรองแสงอาคารทุกแบรนด์ ครบวงจร ทั้งบ้าน คอนโด ออฟฟิศ โชว์รูม โรงงาน โรงแรม',
    logo: 'mhl', color: '#c2620a', soft: '#fdf0e3', company: 'บริษัท มโหฬารฟิล์ม จำกัด (สำนักงานใหญ่)',
    owner: 'เพลง', websiteCount: 2, channelCount: 5,
    info: [
      ['ที่อยู่', '924 ถ.ลาซาล แขวงบางนาใต้ เขตบางนา กรุงเทพฯ 10260'],
      ['เลขผู้เสียภาษี', '0105562143436'],
      ['เวลาทำการ', 'จ.–ส. 08:00–17:00 · ปิดอาทิตย์'],
    ],
    websites: ['maholanfilm.com', 'maxtechfilm.com (MAXTECH Black Carbon ขายส่ง)'],
    channels: ['Call Center 02-055-6886 กด 1', 'มือถือ 094-998-1234 · 097-292-9488', 'LINE @MHL1 · lin.ee/oTPhSQC', 'maholanfilm@gmail.com'],
    socials: ['Facebook: facebook.com/filmmaholan', 'Instagram: @maholan.film', 'TikTok: @maholan.film', 'YouTube: youtube.com/@maholanfilm', 'X: @FilmMaholan'],
    people: ['เพลง (PLENG) · ผู้ดูแล', 'ภูมิ (Poom) · ฝึกงาน'],
  },
  {
    key: 'car', name: 'MHL CAR', short: 'ศูนย์ฟิล์มรถยนต์', summary: 'ศูนย์ติดฟิล์มรถยนต์ บางนา ลาซาล แบริ่ง ศรีนครินทร์',
    aim: 'ศูนย์ติดฟิล์มรถยนต์ครบวงจร ย่านบางนา ลาซาล แบริ่ง ศรีนครินทร์ (3M, Hi-Kool, Cooper, G-TEC, NANOTECH)',
    logo: 'car', color: '#c8202f', soft: '#fde8ea', company: 'บริษัท มโหฬารฟิล์ม จำกัด',
    owner: 'นน', websiteCount: 1, channelCount: 5,
    info: [
      ['ที่อยู่ร้าน', '924 ถ.ลาซาล แขวงบางนาใต้ เขตบางนา กรุงเทพฯ 10260 (MRT ศรีลาซาล)'],
      ['เลขผู้เสียภาษี', '0105562143436'],
      ['เวลาทำการ', 'จ.–ส. 08:00–17:00 · ปิดอาทิตย์'],
    ],
    websites: ['mhlcarfilm.com (MakeWebEasy)'],
    channels: ['Call Center 02-055-6886 กด 2', '095-953-3949 · 099-456-2259', 'LINE @maholan · lin.ee/xPpPOQM', 'mhlcarfilm@gmail.com'],
    socials: ['Facebook: facebook.com/MHLcarfilm', 'Instagram: @mhlcarfilm', 'TikTok: @mhlcarfilm', 'YouTube: ยังไม่พบ'],
    people: ['นน (NON) · ผู้ดูแล', 'ภูมิ · ช่วยโพสต์ผลงานติดตั้ง'],
  },
];

export const COMPANIES: { name: string; logo: LogoKey; color: string; businesses: BusinessKey[] }[] = [
  { name: 'บริษัท กู๊ดฟิล์ม จำกัด', logo: 'gfs', color: '#034aad', businesses: ['b2b', 'b2c'] },
  { name: 'บริษัท มโหฬารฟิล์ม จำกัด', logo: 'mhl', color: '#c2620a', businesses: ['mhl', 'car'] },
];

export const SHARED_ROLES: [string, string][] = [
  ['ทีมขาย & แอดมิน', 'ทำงานให้ทั้ง 2 บริษัท'],
  ['อ.แสน', 'ที่ปรึกษา'],
  ['ภูมิ', 'ฝึกงาน · MHL/CAR'],
  ['มะลิ + ทีม AI 7 คน', 'ใช้ร่วมกัน'],
];

/** Rows of the "ช่องทาง & เว็บ" table; cells follow BUSINESSES order. "—" means none. */
export const CHANNEL_ROWS: { label: string; cells: string[][] }[] = [
  { label: 'เว็บไซต์', cells: [['3m-goodfilm.com', 'goodfilm.co.th · มีแผนพัฒนา'], ['goodfilmshop.com'], ['maholanfilm.com', 'maxtechfilm.com'], ['mhlcarfilm.com']] },
  { label: 'โทรศัพท์', cells: [['092-905-8519 (เฮียปอ)'], ['02-096-3424', '097-097-2103', '062-747-1234', '090-979-3760'], ['02-055-6886 กด 1', '094-998-1234', '097-292-9488'], ['02-055-6886 กด 2', '095-953-3949', '099-456-2259']] },
  { label: 'LINE OA', cells: [['@3mfilm', 'lin.ee/646JMY6'], ['@goodfilm', 'lin.ee/Xwo0pdm'], ['@MHL1', 'lin.ee/oTPhSQC'], ['@maholan', 'lin.ee/xPpPOQM']] },
  { label: 'อีเมล', cells: [GFS_EMAILS, GFS_EMAILS, ['maholanfilm@gmail.com'], ['mhlcarfilm@gmail.com']] },
  { label: 'Facebook', cells: [['facebook.com/3MGoodfilm', 'เพจขายส่งและตัวแทนจำหน่าย'], ['facebook.com/goodfilm3M', 'รับติดตั้งทั่วประเทศ'], ['facebook.com/filmmaholan', 'ศูนย์ให้บริการติดฟิล์มบ้าน คอนโด ออฟฟิศ ครบวงจร'], ['facebook.com/MHLcarfilm', 'ศูนย์ติดตั้งฟิล์มรถยนต์ ครบวงจร บางนา-ลาซาล']] },
  { label: 'Instagram', cells: [['@goodfilm.shop', 'ใช้ร่วมกับ GFS B2C'], ['@goodfilm.shop'], ['@maholan.film'], ['@mhlcarfilm']] },
  { label: 'TikTok', cells: [['—'], ['@goodfilm3m'], ['@maholan.film'], ['@mhlcarfilm']] },
  { label: 'YouTube', cells: [['youtube.com/@goodfilm3M', 'ใช้ร่วมกับ GFS B2C'], ['youtube.com/@goodfilm3M'], ['youtube.com/@maholanfilm'], ['ยังไม่พบ']] },
  { label: 'X (Twitter)', cells: [['—'], ['—'], ['@FilmMaholan'], ['—']] },
];
export const OPENING_HOURS = 'จันทร์–เสาร์ 08:00–17:00 · ปิดวันอาทิตย์ (ทุกธุรกิจ)';

export const PEOPLE: { initial: string; name: string; role: string; duty: string; color: string }[] = [
  { initial: 'O', name: 'พี่ออย (OIL)', role: 'Admin · ผู้อนุมัติ', duty: 'ดูภาพรวมทุกธุรกิจ อนุมัติงาน งบ และการแก้ของจริง', color: 'var(--color-primary)' },
  { initial: 'T', name: 'แต้ว (TAW)', role: 'GFS B2B', duty: 'ดูแล GFS ขายส่งยกม้วน และช่วยอนุมัติงานของจ๋าย', color: '#1b437c' },
  { initial: 'จ', name: 'จ๋าย', role: 'GFS B2C', duty: 'คอนเทนต์ Facebook GFS B2C (งานส่งผ่านโต๊ะแต้ว)', color: '#034aad' },
  { initial: 'P', name: 'เพลง (PLENG)', role: 'MHL อาคาร', duty: 'คอนเทนต์และรูปผลงานติดตั้งอาคาร ส่งงานให้ iCONS', color: '#c2620a' },
  { initial: 'N', name: 'นน (NON)', role: 'MHL CAR', duty: 'คอนเทนต์และรีวิวงานติดฟิล์มรถ', color: '#c8202f' },
  { initial: 'P', name: 'ภูมิ (Poom)', role: 'นักศึกษาฝึกงาน', duty: 'คอนเทนต์ MHL อาคาร และผลงานติดตั้ง CAR', color: '#64748b' },
  { initial: 'ป', name: 'เฮียปอ', role: 'รับลีดขายส่ง', duty: 'ตอบ 092-905-8519 และ LINE @3mfilm ของ GFS B2B', color: '#1b437c' },
  { initial: 'ม', name: 'คุณมิ้น / ReadyPlanet', role: 'เอเจนซี Google Ads', duty: 'ดูแลบัญชี Google Ads ของ GFS B2C และ MHL อาคาร', color: '#034aad' },
  { initial: 'ส', name: 'อ.แสน', role: 'ที่ปรึกษา', duty: 'มีสิทธิ์เข้าบัญชีโฆษณา', color: '#10b981' },
];
