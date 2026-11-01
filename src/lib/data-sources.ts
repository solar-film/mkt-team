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

export type LiveKey = 'ads' | 'sheet';

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
    what: 'ค่าโฆษณา Facebook · Google · ChatGPT',
    from: 'Facebook / Google / ChatGPT Ads',
    to: 'หน้า ข้อมูลตลาด',
    when: 'ทุกวัน 06:00 (ดึง 10 วันล่าสุด)',
    expires: { date: '2026-11-30', label: 'ทดลองใช้ฟรี ถึง ~30 พ.ย. 69' },
    cost: 'ฟรีช่วงทดลอง · หลังจากนั้นต้องสมัคร (แผนเล็กสุด ~$19/เดือน จ่ายรายปี)',
    status: 'ok',
    todo: 'สมัครแผนก่อนหมดทดลอง ไม่งั้นยอดโฆษณาจะหยุดอัปเดต',
    live: 'ads',
    link: { label: 'เปิด Windsor', url: 'https://onboard.windsor.ai/app/settings/account' },
    checkedAt: '2026-11-01',
  },
  {
    id: 'sheet',
    name: 'Google Sheet ยอดใช้โฆษณา 2569',
    what: 'ยอดขาย เป้า งบ และค่าโฆษณารายเดือน',
    from: 'ชีตที่มะลิอัปเดต',
    to: 'หน้า โครงสร้างธุรกิจ',
    when: 'มะลิเขียนชีตทุกเช้า · เว็บอ่านใหม่ทุก 30 นาที',
    expires: { text: 'ไม่หมดอายุ' },
    cost: 'ฟรี',
    status: 'ok',
    todo: 'Supermetrics เลิกใช้แล้ว ต้องหาตัวดึงค่าโฆษณาเข้าชีตแทน',
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
    what: 'เปิดเว็บ และสั่งงานตามเวลา 2 งาน',
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
    what: 'ทดลองดึง Google Analytics (GA4) · ยังไม่ส่งเข้าเว็บ',
    from: 'Google Analytics 4',
    to: '— (ยังไม่ได้ต่อ)',
    when: 'ไม่มีงานเปิดอัตโนมัติ (0/2)',
    expires: { text: 'ไม่หมดอายุ · เครดิตรีเซ็ต ~22 พ.ย. 69' },
    cost: 'ฟรี 1,000 เครดิต/เดือน',
    usage: '~12 จาก 1,000 เครดิต (1%)',
    status: 'idle',
    link: { label: 'เปิด Make', url: 'https://eu1.make.com/' },
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

const RANK: Record<SourceStatus, number> = { idle: 0, ok: 1, soon: 2, problem: 3 };
/** The more urgent of two statuses; an idle source stays idle. */
export const worst = (a: SourceStatus, b: SourceStatus): SourceStatus =>
  a === 'idle' ? a : RANK[b] > RANK[a] ? b : a;
