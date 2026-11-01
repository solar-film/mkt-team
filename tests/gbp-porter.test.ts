import assert from 'node:assert/strict';
import test from 'node:test';
import { parsePorterSheet, porterReviewId, PORTER_SOURCE } from '../src/lib/gbp-porter';

// Column labels as Porter Metrics writes them for the Google Business Profile connector
const HEADERS = [
  'Location name',
  'Review creation date',
  'Reviewer',
  'Review star rating (Number)',
  'Review comment',
  'Review reply comment',
  'Review Time to Respond (Hours)',
  'Total reviews time frame',
  'Total reviews',
  'Total average review rating',
];

test('parses newest reviews with owner replies per business, newest first', () => {
  const { reviewsByLoc, statsByLoc } = parsePorterSheet([
    {
      title: 'GBP reviews',
      values: [
        HEADERS,
        ['MHL CAR FILM - ศูนย์ติดตั้งฟิล์มรถยนต์', '2026-10-20 09:15:00', 'Somchai', '5', 'ติดฟิล์มดีมาก', 'ขอบคุณครับ', '2', '12', '683', '4.9'],
        ['MHL CAR FILM - ศูนย์ติดตั้งฟิล์มรถยนต์', '2026-10-31 18:02:11', 'Anong', '4', 'บริการดี', '', '', '12', '683', '4.9'],
        ['Goodfilm - ฟิล์มอาคาร 3M', '2026-10-28 10:00:00', 'Kitti', 'FIVE', 'ราคาดี', 'ยินดีค่ะ', '1', '2', '111', '4.9'],
        ['Maholan Film Co., Ltd.', '2026-10-30 11:00:00', '', '5', '', '', '', '1', '91', '4.9'],
      ],
    },
  ]);

  assert.equal(reviewsByLoc['loc-car'].length, 2);
  assert.equal(reviewsByLoc['loc-car'][0].reviewDate, '2026-10-31');
  assert.equal(reviewsByLoc['loc-car'][0].replyText, '');
  assert.equal(reviewsByLoc['loc-car'][1].replyText, 'ขอบคุณครับ');
  assert.equal(reviewsByLoc['loc-car'][1].rating, 5);
  assert.equal(reviewsByLoc['loc-car'][0].source, PORTER_SOURCE);

  assert.equal(reviewsByLoc['loc-gfs'][0].rating, 5);
  assert.equal(reviewsByLoc['loc-gfs'][0].replyText, 'ยินดีค่ะ');

  // Star-only review without name or text is still kept
  assert.equal(reviewsByLoc['loc-mhl'].length, 1);
  assert.equal(reviewsByLoc['loc-mhl'][0].reviewerName, 'ลูกค้า Google Maps');

  // All-time total, not the period count
  assert.equal(statsByLoc['loc-car'].totalReviews, 683);
  assert.equal(statsByLoc['loc-car'].rating, 4.9);
});

test('review ids are stable across syncs and duplicates are dropped', () => {
  const row = ['MHL CAR', '2026-10-20 09:15:00', 'Somchai', '5', 'ดีมาก', '', '', '', '', ''];
  const first = parsePorterSheet([{ title: 'a', values: [HEADERS, row, row] }]);
  const second = parsePorterSheet([{ title: 'b', values: [HEADERS, row] }]);
  assert.equal(first.reviewsByLoc['loc-car'].length, 1);
  assert.equal(first.reviewsByLoc['loc-car'][0].id, second.reviewsByLoc['loc-car'][0].id);
  assert.equal(
    first.reviewsByLoc['loc-car'][0].id,
    porterReviewId('loc-car', '2026-10-20 09:15:00', 'Somchai', 'ดีมาก')
  );
});

test('raw Porter field ids as headers and tab title as business fallback', () => {
  const { reviewsByLoc } = parsePorterSheet([
    {
      title: 'GOODFILM',
      values: [
        ['reviewCreationTime', 'reviewIntegerRating', 'reviewComment', 'reviewerReplyComment'],
        ['2026-10-29T03:00:00Z', '3', 'โอเค', 'ขอบคุณสำหรับคำแนะนำ'],
      ],
    },
  ]);
  assert.equal(reviewsByLoc['loc-gfs'].length, 1);
  assert.equal(reviewsByLoc['loc-gfs'][0].rating, 3);
  assert.equal(reviewsByLoc['loc-gfs'][0].replyText, 'ขอบคุณสำหรับคำแนะนำ');
  assert.equal(reviewsByLoc['loc-gfs'][0].reviewDate, '2026-10-29');
});
