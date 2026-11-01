import test from 'node:test';
import assert from 'node:assert/strict';
import { d7Due, matchPosts, normalizeFacebookPosts, postAgeDays, squashText } from '../src/lib/facebook-posts';
import { ManualAdsError, parseManualAds, skippedPlatforms } from '../src/lib/manual-ads';
import { brandOf } from '../src/lib/ads-data';

const th = (day: string, hour = 12) => new Date(`${day}T${String(hour).padStart(2, '0')}:00:00+07:00`);

test('Windsor rows become posts; bad rows are dropped and counts kept as numbers', () => {
  const posts = normalizeFacebookPosts([
    { post_id: '111_222', post_created_time: '2026-10-01T10:00:09+0000', post_message: 'สวัสดี', post_total_media_view_unique: 248, post_reactions_total: 0, post_comments_total: null },
    { post_id: '', post_created_time: '2026-10-01T10:00:09+0000' },
    { post_id: '111_333', post_created_time: 'not a date' },
    { post_id: '111_222', post_created_time: '2026-10-01T10:00:09+0000', post_message: 'ซ้ำ', post_total_media_view_unique: 250 },
  ]);
  assert.equal(posts.length, 1);
  assert.deepEqual({ ...posts[0], createdTime: posts[0].createdTime.toISOString() }, {
    id: '111_222', pageId: '111', createdTime: '2026-10-01T10:00:09.000Z', message: 'ซ้ำ', reach: 250, reactions: null, comments: null,
  });
  assert.throws(() => normalizeFacebookPosts({ error: 'x' }));
});

test('text compare ignores emoji, spaces and punctuation', () => {
  assert.equal(squashText('✨ Mercedes-Benz E250  เข้ารับบริการ!'), squashText('Mercedes Benz E250 เข้ารับบริการ'));
});

const post = (id: string, day: string, message: string) => ({ id, createdTime: th(day), message });
const content = (id: string, day: string, title: string) => ({ id, title, publishDate: th(day, 9) });

test('a post matches the content whose title starts the post, within one day', () => {
  const m = matchPosts(
    [post('p1', '2026-10-01', 'Suzuki Swift × 3M Ceramic Absolute\n🚗 SUZUKI SWIFT จัดฟิล์มให้ครบ'), post('p2', '2026-10-03', 'โพสต์ที่ไม่มีในระบบ')],
    [content('c1', '2026-10-02', 'Suzuki Swift × 3M Ceramic Absolute'), content('c2', '2026-10-03', 'MG ZS 3M Ceramic Ultra Clear')],
  );
  assert.deepEqual([...m], [['p1', 'c1']]);
});

test('too far apart in days, too short a title, or an ambiguous tie stays unmatched', () => {
  const far = matchPosts([post('p1', '2026-10-05', 'Suzuki Swift × 3M Ceramic Absolute')], [content('c1', '2026-10-02', 'Suzuki Swift × 3M Ceramic Absolute')]);
  assert.equal(far.size, 0);
  const short = matchPosts([post('p1', '2026-10-02', 'โปรโมชั่น แจกร่ม')], [content('c1', '2026-10-02', 'โปร')]);
  assert.equal(short.size, 0);
  const tie = matchPosts([post('p1', '2026-10-02', 'ติดฟิล์มกับ MHL ได้อะไร มากกว่าฟิล์ม')],
    [content('c1', '2026-10-02', 'ติดฟิล์มกับ MHL ได้อะไร'), content('c2', '2026-10-02', 'ติดฟิล์มกับ MHL ได้อะไร')]);
  assert.equal(tie.size, 0);
});

test('the same-day content wins, and each content takes one post only', () => {
  const m = matchPosts(
    [post('p1', '2026-10-02', 'ฟิล์มพอง เป็นฟอง? ให้ MHL CAR เปลี่ยนใหม่'), post('p2', '2026-10-02', 'ฟิล์มพอง เป็นฟอง? ให้ MHL CAR เปลี่ยนใหม่ อีกโพสต์')],
    [content('c1', '2026-10-01', 'ฟิล์มพอง เป็นฟอง? ให้ MHL CAR เปลี่ยนใหม่!'), content('c2', '2026-10-02', 'ฟิล์มพอง เป็นฟอง? ให้ MHL CAR เปลี่ยนใหม่!')],
  );
  assert.equal(m.get('p1'), 'c2');
  assert.equal(m.get('p2'), 'c1');
  assert.equal(matchPosts([post('p1', '2026-10-02', 'ฟิล์มพอง เป็นฟอง? ให้ MHL CAR')], [content('c1', '2026-10-02', 'ฟิล์มพอง เป็นฟอง? ให้ MHL CAR')], new Set(['c1'])).size, 0, 'already taken');
});

test('D+7 is recorded only while the post is 7–9 Thai days old', () => {
  const now = th('2026-11-10', 6);
  assert.equal(postAgeDays(th('2026-11-03', 23), now), 7);
  assert.equal(d7Due(th('2026-11-04'), now), false);
  assert.equal(d7Due(th('2026-11-03'), now), true);
  assert.equal(d7Due(th('2026-11-01'), now), true);
  assert.equal(d7Due(th('2026-10-31'), now), false, 'too old: reach has kept growing');
});

test('typed-in ChatGPT spend: validates amounts and month, stays GFS B2C', () => {
  assert.deepEqual(parseManualAds({ month: '2026-11', spend: '12,619.50', clicks: '300' }),
    { platform: 'openai_ads', month: '2026-11', spend: 12619.5, impressions: 0, clicks: 300, leads: 0 });
  assert.throws(() => parseManualAds({ month: '2026-13', spend: 1 }), ManualAdsError);
  assert.throws(() => parseManualAds({ month: '2026-11', spend: -1 }), ManualAdsError);
  assert.throws(() => parseManualAds({ platform: 'facebook', month: '2026-11', spend: 1 }), ManualAdsError);
  assert.equal(brandOf('Goodfilm ChatGPT Ads (กรอกเอง)'), 'GFS B2C');
});

test('WINDSOR_SKIP_PLATFORMS lists platforms the nightly sync leaves alone', () => {
  assert.deepEqual([...skippedPlatforms({ WINDSOR_SKIP_PLATFORMS: ' openai_ads , ' })], ['openai_ads']);
  assert.equal(skippedPlatforms({}).size, 0);
});

test('reordered titles match by words; shared words alone ("3M Ceramic Ultra Clear") do not (real Oct posts)', () => {
  const m = matchPosts(
    [
      post('general', '2026-10-07', 'ฟิล์ม 3M Ceramic Ultra Clear ดียังไง?\n☀️ ลดความร้อน'),
      post('mazda', '2026-10-03', 'MAZDA 6E จัดฟิล์มให้ครบ พร้อมขับสบายทุกเส้นทางด้วย 3M Ceramic Ultra Clear'),
      post('mgzs', '2026-10-08', '🚙💙 MG ZS จัดฟิล์มรอบคันด้วย 3M Ceramic Ultra Clear เพิ่มความสบายให้ทุกการเดินทาง'),
    ],
    [content('c-mazda', '2026-10-03', 'MAZDA 6E 3M Ceramic Ultra Clear'), content('c-mgzs', '2026-10-08', 'MG ZS  3M Ceramic Ultra Clear')],
  );
  assert.deepEqual(Object.fromEntries(m), { mazda: 'c-mazda', mgzs: 'c-mgzs' });
});

test('title score: exact start 2, word share otherwise, 0 without the first word or when too short', async () => {
  const { titleScore } = await import('../src/lib/facebook-posts');
  const text = squashText('HONDA HR-V จัดเต็มรอบคันด้วย Super Hi-Kool BEYOND CERAMIC พร้อมรับร่ม');
  assert.equal(titleScore('HONDA HR-V จัดเต็มรอบคัน', text), 2);
  assert.equal(titleScore('HONDA HR-V Super Hi-Kool BEYOND CERAMIC', text), 1);
  assert.equal(titleScore('TOYOTA HR-V Super Hi-Kool BEYOND CERAMIC', text), 0);
  assert.equal(titleScore('HI-CM 35', text), 0);
});
