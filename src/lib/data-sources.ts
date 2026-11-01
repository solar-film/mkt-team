// What feeds the site, where it comes from, when it expires and what it costs — for the
// แหล่งข้อมูล page. Plans, quotas and expiry dates have no API the site can read, so they are
// written here with the day they were checked; the page adds live sync times from the database
// and the summary sheet. This repository is public: no account ids, sheet ids or keys here.

export type SourceStatus = 'ok' | 'soon' | 'problem' | 'idle';

export const STATUS_LABEL: Record<SourceStatus, string> = {
  ok: 'ปกติ',
  soon: 'ต้องระวัง',
  problem: 'มีปัญหา',
  idle: 'ไม่ได้ใช้',
};

export type LiveKey = 'ads' | 'sheet' | 'gbp';

export interface DataSource {
  id: string;
  name: string;
  /** What the site gets from it, in a few words. */
  what: string;
  from: string;
  to: string;
  /** When it runs. */
  when: string;
  /** How long it lasts: a date (YYYY-MM-DD, counted down on the page) or plain text. */
  expires: { date: string; label: string } | { text: string };
  cost: string;
  /** Credits or quota used, as last seen on the provider's own page. */
  usage?: string;
  /** Status written by hand; live data (`live`) or the expiry date may raise it. */
  status: SourceStatus;
  /** One short line on what needs doing, shown when the status is not ok. */
  todo?: string;
  live?: LiveKey;
  link: { label: string; url: string };
  checkedAt: string;
}

export const DATA_SOURCES: DataSource[] = [
  {
    id: 'windsor',
    name: 'Windsor.ai',
    what: 'ค่าโฆษณา Facebook · Google และ Reach โพสต์เพจ Facebook',
    from: 'Facebook Ads 5 บัญชี · Google Ads 6 บัญชี · เพจ Facebook 4 เพจ',
    to: 'หน้า ข้อมูลตลาด · สรุปผลงาน & ประเมิน',
    when: 'ทุกวัน 06:00 ค่าโฆษณา (10 วันล่าสุด) · 06:30 โพสต์เพจ (12 วันล่าสุด)',
    expires: { date: '2026-11-30', label: 'ทดลองใช้ฟรี ถึง ~30 พ.ย. 69' },
    cost: 'ฟรีช่วงทดลอง · วางแผนใช้ Basic $19/เดือน (จ่ายรายปี $228) หรือ $23 ถ้าจ่ายรายเดือน',
    usage: '3 แหล่งข้อมูล / 15 บัญชี–เพจ อยู่ในโควตา Basic (3 แหล่ง) · ChatGPT Ads ย้ายไปกรอกเองที่หน้า admin แล้ว',
    status: 'ok',
    todo: 'สมัครแผนก่อนหมดทดลอง ไม่งั้นยอดโฆษณาจะหยุดอัปเดต',
    live: 'ads',
    link: { label: 'เปิด Windsor', url: 'https://onboard.windsor.ai/app/settings/account' },
    checkedAt: '2026-11-01',
  },
  {
    id: 'sheet',
    name: 'Google Sheet ยอดใช้โฆษณา 2569',
    what: 'ยอดขาย เป้าขาย งบ Ads (ค่าโฆษณาใช้จาก Windsor แล้ว)',
    from: 'ชีตที่มะลิอัปเดต',
    to: 'หน้า โครงสร้างธุรกิจ',
    when: 'มะลิเขียนชีตทุกเช้า · เว็บอ่านใหม่ทุก 30 นาที',
    expires: { text: 'ไม่หมดอายุ' },
    cost: 'ฟรี',
    status: 'ok',
    todo: 'ยอดขายในหน้าโครงสร้างธุรกิจจะค้าง จนกว่าจะมีคนอัปเดตชีตอีกครั้ง',
    live: 'sheet',
    link: { label: 'เปิดชีต', url: 'https://docs.google.com/spreadsheets/' },
    checkedAt: '2026-11-01',
  },
  {
    id: 'line',
    name: 'LINE แจ้งเตือน',
    what: 'เตือนงานใกล้กำหนดเข้ากลุ่ม LINE',
    from: 'เว็บ',
    to: 'กลุ่ม LINE ทีม',
    when: 'ทุกวัน 08:00',
    expires: { text: 'ยังไม่ได้ตรวจ' },
    cost: 'ยังไม่ได้ตรวจแพ็กเกจ LINE OA',
    status: 'ok',
    link: { label: 'เปิด LINE OA', url: 'https://manager.line.biz/' },
    checkedAt: '2026-11-01',
  },
  {
    id: 'supabase',
    name: 'Supabase (ฐานข้อมูล)',
    what: 'งาน คอนเทนต์ KPI ประชุม ไอเดีย ยอดโฆษณา',
    from: 'เว็บ',
    to: 'ฐานข้อมูล',
    when: 'ตลอดเวลา',
    expires: { text: 'ไม่หมดอายุ' },
    cost: 'ฟรี (แพ็กเกจ Free)',
    usage: 'เคยใช้ข้อมูลเกินโควตาฟรี · ขึ้นป้าย "Grace period is over" (31 ต.ค.)',
    status: 'soon',
    todo: 'ดูโควตาใน Supabase ถ้าเกินอีก ฐานข้อมูลอาจถูกจำกัด',
    link: { label: 'เปิด Supabase', url: 'https://supabase.com/dashboard' },
    checkedAt: '2026-10-31',
  },
  {
    id: 'vercel',
    name: 'Vercel (ตัวเว็บ)',
    what: 'เปิดเว็บ และสั่งงานตามเวลา 4 งาน (เตือน LINE, ค่าโฆษณา, ข้อมูลการติดต่อ, โพสต์ Facebook)',
    from: 'โค้ดใน GitHub',
    to: 'mkt-team.vercel.app',
    when: 'ตลอดเวลา',
    expires: { text: 'ไม่หมดอายุ' },
    cost: 'ฟรี (แพ็กเกจ Hobby)',
    status: 'ok',
    link: { label: 'เปิด Vercel', url: 'https://vercel.com/dashboard' },
    checkedAt: '2026-11-01',
  },
  {
    id: 'make',
    name: 'Make.com',
    what: 'ดึง Google Analytics 4 ของเว็บไซต์ · ยังไม่ส่งเข้าเว็บ MKT',
    from: 'GA4 5 Properties (ทดสอบแล้วครบ) · Facebook Messenger → Google Sheets (ยังไม่ยืนยันว่าดึงแชตได้)',
    to: '— (ยังไม่ได้ต่อเข้าเว็บ MKT)',
    when: 'ยังไม่ได้ตรวจตารางเวลา',
    expires: { text: 'ไม่หมดอายุ · เครดิตรีเซ็ต ~22 พ.ย. 69' },
    cost: 'ฟรี 1,000 เครดิต/เดือน · ต้องคุมจำนวนรันไม่ให้เกินโควตา',
    usage: '~12 จาก 1,000 เครดิต (ตรวจ 1 พ.ย. ก่อนทดสอบ GA4)',
    status: 'idle',
    link: { label: 'เปิด Make', url: 'https://eu1.make.com/' },
    checkedAt: '2026-11-01',
  },
  {
    id: 'porter',
    name: 'Google Maps API · Porter Metrics',
    what: 'คะแนนดาว ยอดรีวิวสะสม และ 10 รีวิวล่าสุด Google Maps แยก 3 ธุรกิจ',
    from: 'Google Maps 3 สถานที่ (ดึงอัตโนมัติผ่าน Places API / Porter Sheet เสริม)',
    to: 'หน้า รีวิวบน Google Maps',
    when: 'ดึงเข้าฐานข้อมูลอัตโนมัติทุกวัน 07:00 (และอัปเดตเมื่อข้อมูลเก่าเกิน 6 ชม.)',
    expires: { text: 'ไม่หมดอายุ (โควตาฟรี Google Cloud รายเดือน + Porter Free forever)' },
    cost: 'ฟรี $0 (ใช้ ~180 ครั้ง/เดือน อยู่ในโควตาฟรี Google Places 1,000 ครั้ง/เดือน)',
    usage: '3 สถานที่ (MHL CAR, GOODFILM, MHL อาคาร) · เก็บสูงสุด 10 รีวิวล่าสุด/ธุรกิจในฐานข้อมูล',
    status: 'ok',
    todo: 'ตรวจสอบ Service Account หรือสถานะการดึง Google Places API',
    live: 'gbp',
    link: { label: 'เปิด Porter', url: 'https://portermetrics.com/' },
    checkedAt: '2026-11-01',
  },
];

const DAY = 86_400_000;
const dayNumber = (isoDate: string) => {
  const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number);
  return Date.UTC(y, m - 1, d) / DAY;
};

/** Whole days from `today` to `date` (both YYYY-MM-DD); negative once passed. */
export const daysUntil = (date: string, today: string) => dayNumber(date) - dayNumber(today);

/** Expiry within 7 days (or passed) is a problem; within 30 days it is coming up. */
export function expiryStatus(daysLeft: number): SourceStatus {
  if (daysLeft <= 7) return 'problem';
  if (daysLeft <= 30) return 'soon';
  return 'ok';
}

/** The sheet is rewritten each morning; data more than 3 days behind means the writer stopped. */
export function sheetStatus(dataThrough: string, today: string): SourceStatus {
  return daysUntil(today, dataThrough) > 3 ? 'problem' : 'ok';
}

/** Ads are pulled every morning; a failed last run, or no success for 2 days, is a problem. */
export function adsStatus(lastOkAt: string | null, lastFailed: boolean, today: string): SourceStatus {
  if (lastFailed || !lastOkAt) return 'problem';
  return daysUntil(today, lastOkAt) > 2 ? 'problem' : 'ok';
}

/** GBP reviews sync daily at 07:00 once a Google Sheet is linked; flag errors or stale syncs (>2 days). */
export function gbpStatus(
  configured: boolean,
  lastOk: boolean | null,
  lastSyncedDate: string | null,
  today: string
): SourceStatus {
  if (!configured) return 'ok';
  if (lastOk === false) return 'problem';
  if (lastSyncedDate && daysUntil(today, lastSyncedDate) > 2) return 'problem';
  return 'ok';
}

const RANK: Record<SourceStatus, number> = { idle: 0, ok: 1, soon: 2, problem: 3 };
/** The more urgent of two statuses; an idle source stays idle. */
export const worst = (a: SourceStatus, b: SourceStatus): SourceStatus =>
  a === 'idle' ? a : RANK[b] > RANK[a] ? b : a;
