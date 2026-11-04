import test from 'node:test';
import assert from 'node:assert/strict';
import { backfillAction, backfillParts, backfillRange, isVideoShareLink, matchByVideo, matchByPostLink, videoIdFromUrl, d7Due, matchPosts, normalizeFacebookPosts, postAgeDays, squashText } from '../src/lib/facebook-posts';
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
    id: '111_222', pageId: '111', createdTime: '2026-10-01T10:00:09.000Z', message: 'ซ้ำ', reach: 250, reactions: null, comments: null, videoId: null,
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

test('backfill keeps a typed reach, fills an empty or 0 one, creates a missing D+7', () => {
  assert.equal(backfillAction(null), 'create');
  assert.equal(backfillAction({ reach: null }), 'fill');
  assert.equal(backfillAction({ reach: 0 }), 'fill');
  assert.equal(backfillAction({ reach: 35 }), 'keep');
});

test('backfill month: whole month, cut at today, no future or malformed month', () => {
  assert.deepEqual(backfillRange('2026-10', '2026-11-01'), { from: '2026-10-01', to: '2026-10-31' });
  assert.deepEqual(backfillRange('2026-02', '2026-11-01'), { from: '2026-02-01', to: '2026-02-28' });
  assert.deepEqual(backfillRange('2026-11', '2026-11-20'), { from: '2026-11-01', to: '2026-11-20' });
  assert.equal(backfillRange('2026-12', '2026-11-20'), null);
  assert.equal(backfillRange('2026-13', '2026-11-20'), null);
  assert.equal(backfillRange('2024-12', '2026-11-20'), null);
  assert.equal(backfillRange('10/2026', '2026-11-20'), null);
});

test('backfill parts: a month in runs of 7 days, cut at today', () => {
  assert.deepEqual(backfillParts('2026-10', '2026-11-01'), [
    { from: '2026-10-01', to: '2026-10-07' }, { from: '2026-10-08', to: '2026-10-14' }, { from: '2026-10-15', to: '2026-10-21' },
    { from: '2026-10-22', to: '2026-10-28' }, { from: '2026-10-29', to: '2026-10-31' },
  ]);
  assert.deepEqual(backfillParts('2026-11', '2026-11-09'), [{ from: '2026-11-01', to: '2026-11-07' }, { from: '2026-11-08', to: '2026-11-09' }]);
  assert.deepEqual(backfillParts('2026-12', '2026-11-09'), []);
});

test('reel number from Facebook links; ordinary post links have none', () => {
  assert.equal(videoIdFromUrl('https://www.facebook.com/reel/2893962230973462/?rdid=x&share_url=y'), '2893962230973462');
  assert.equal(videoIdFromUrl('https://www.facebook.com/reel/1136055478772168/'), '1136055478772168');
  assert.equal(videoIdFromUrl('https://www.facebook.com/3MGoodfilm/videos/987654321012345/'), '987654321012345');
  assert.equal(videoIdFromUrl('https://www.facebook.com/watch/?v=123456789012'), '123456789012');
  assert.equal(videoIdFromUrl('https://www.facebook.com/1439578268371426/posts/1411114034551183'), null);
  assert.equal(videoIdFromUrl('https://www.facebook.com/3MGoodfilm/posts/pfbid0nVBEPVbph'), null);
  assert.equal(videoIdFromUrl('https://www.facebook.com/share/r/1LDbaccVKo/'), null);
  assert.equal(videoIdFromUrl(null), null);
  assert.equal(isVideoShareLink('https://www.facebook.com/share/r/1LDbaccVKo/'), true);
  assert.equal(isVideoShareLink('https://www.facebook.com/share/v/1Ab/'), true);
  assert.equal(isVideoShareLink('https://www.facebook.com/share/p/14tHa8e7hYk/'), false);
});

test('Windsor permalink gives the post its reel number, and link pairs are exact and one to one', () => {
  const [reel, post] = normalizeFacebookPosts([
    { post_id: 'p_1', post_created_time: '2026-10-30T09:46:51+0000', post_message: 'x', permalink_url: 'https://www.facebook.com/reel/2893962230973462/' },
    { post_id: 'p_2', post_created_time: '2026-10-30T08:00:08+0000', post_message: 'y', permalink_url: 'https://www.facebook.com/1439578268371426/posts/1438684171794169' },
  ]);
  assert.equal(reel.videoId, '2893962230973462');
  assert.equal(post.videoId, null);
  const videos = new Map([['c1', '2893962230973462'], ['c2', '2893962230973462'], ['c3', '111111111']]);
  assert.deepEqual([...matchByVideo([reel, post], videos)], [['p_1', 'c1']]);
  assert.deepEqual([...matchByVideo([reel], videos, new Set(['c1']))], [['p_1', 'c2']]);
});

test('the two July photo links match their pcb post IDs, never the individual photo fbid', () => {
  const matches = matchByPostLink([
    { id: '101634951180913_1417619013721591' },
    { id: '109607531869658_1001239392722056' },
    { id: '101634951180913_1417618987054927' },
  ], [
    { id: 'mhl-july-1', link: 'https://www.facebook.com/photo/?fbid=1417618987054927&set=pcb.1417619013721591' },
    { id: 'car-july-1', link: 'https://www.facebook.com/photo/?fbid=1001239352722060&set=pcb.1001239392722056' },
  ]);
  assert.deepEqual([...matches], [
    ['101634951180913_1417619013721591', 'mhl-july-1'],
    ['109607531869658_1001239392722056', 'car-july-1'],
  ]);
});

test('numeric posts, permalink story_fbid, and photo.php pcb links match on Facebook hosts', () => {
  assert.deepEqual([...matchByPostLink([
    { id: 'page_111111111' }, { id: 'page_222222222' }, { id: 'page_333333333' },
  ], [
    { id: 'post', link: 'https://www.facebook.com/3MGoodfilm/posts/111111111/?utm_source=test' },
    { id: 'story', link: 'http://m.facebook.com/permalink.php?story_fbid=222222222&id=123' },
    { id: 'photo', link: 'https://facebook.com/photo.php?fbid=999999999&set=pcb.333333333&type=3' },
  ])], [['page_111111111', 'post'], ['page_222222222', 'story'], ['page_333333333', 'photo']]);
});

test('post-link matching rejects spoofed hosts, credentials, ports, non-http URLs, photo IDs and album sets', () => {
  const links = [
    'https://facebook.com.attacker.test/page/posts/123456789',
    'https://facebook.com@attacker.test/page/posts/123456789',
    'https://user:password@facebook.com/page/posts/123456789',
    'https://@facebook.com/page/posts/123456789',
    'https://facebook.com:444/page/posts/123456789',
    'https://facebook.com:443/page/posts/123456789',
    'http://facebook.com:80/page/posts/123456789',
    'ftp://facebook.com/page/posts/123456789',
    '//facebook.com/page/posts/123456789',
    'facebook.com/page/posts/123456789',
    'https://instagram.com/page/posts/123456789',
    'https://facebook.com/page/posts/123456789/extra',
    'https://facebook.com/page/posts/pfbid123456789',
    'https://facebook.com/photo/?fbid=123456789',
    'https://facebook.com/photo/?fbid=123456789&set=a.123456789',
    'https://facebook.com/photo/?set=pcb.123456789.extra',
    'https://facebook.com/photo/?set=pcb.123456789&set=pcb.987654321',
    'https://facebook.com/permalink.php?fbid=123456789',
    'https://facebook.com/permalink.php?story_fbid=123456789&story_fbid=987654321',
  ];
  for (const link of links) assert.equal(matchByPostLink([{ id: 'page_123456789' }], [{ id: 'c', link }]).size, 0, link);
  assert.equal(matchByPostLink([{ id: 'page_123456789' }], [{ id: 'c', link: null }]).size, 0);
});

test('identical duplicate rows are deduplicated but multiple content IDs or source IDs stay unmatched', () => {
  const linked = { id: 'c1', link: 'https://facebook.com/page/posts/123456789' };
  assert.deepEqual([...matchByPostLink([{ id: 'page_123456789' }, { id: 'page_123456789' }], [linked, linked])], [['page_123456789', 'c1']]);
  assert.equal(matchByPostLink([{ id: 'page_123456789' }], [linked, { ...linked, id: 'c2' }]).size, 0);
  assert.equal(matchByPostLink([{ id: 'pageA_123456789' }, { id: 'pageB_123456789' }], [linked]).size, 0);
  // These two content rows really share the same pcb link, so neither is selected.
  assert.equal(matchByPostLink([{ id: '109607531869658_990305933815402' }], [
    { id: 'k9ru9l05mqhv3633', link: 'https://www.facebook.com/photo/?fbid=990305900482072&set=pcb.990305933815402' },
    { id: 'qlj70z9wmqhv1pes', link: 'https://www.facebook.com/photo/?fbid=990305900482072&set=pcb.990305933815402' },
  ]).size, 0);
});

test('a content linked to conflicting post IDs or an already taken content is not paired', () => {
  assert.equal(matchByPostLink([{ id: 'page_111111111' }, { id: 'page_222222222' }], [
    { id: 'c', link: 'https://facebook.com/page/posts/111111111' },
    { id: 'c', link: 'https://facebook.com/page/posts/222222222' },
  ]).size, 0);
  const taken = new Set(['c']);
  assert.equal(matchByPostLink([{ id: 'page_111111111' }], [{ id: 'c', link: 'https://facebook.com/page/posts/111111111' }], taken).size, 0);
  assert.deepEqual([...taken], ['c']);
});

test('page D+7 figures use a source the live database accepts', async () => {
  const { PAGE_METRIC_SOURCE } = await import('../src/lib/facebook-posts');
  // ContentMetric_source_check on the live database (read 1 Nov 69).
  assert.ok(['manual', 'import', 'api'].includes(PAGE_METRIC_SOURCE));
  assert.notEqual(PAGE_METRIC_SOURCE, 'manual');
});
