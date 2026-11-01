import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  DEFAULT_LOCATIONS,
  ensureGbpTables,
  getGbpSyncInfo,
  loadGbpPageDataFast,
  MAX_REVIEWS_PER_BUSINESS,
  saveGbpSheetConfig,
  syncGbpReviews,
  syncPorterGbpSheet,
} from '@/lib/gbp-sync';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET() {
  try {
    const { locations, reviews, syncInfo } = await loadGbpPageDataFast();
    return NextResponse.json({
      locations,
      reviews,
      maxPerBusiness: MAX_REVIEWS_PER_BUSINESS,
      syncInfo,
    });
  } catch (error) {
    console.error('Failed to load GBP data:', error);
    return NextResponse.json({
      locations: DEFAULT_LOCATIONS,
      reviews: [],
      maxPerBusiness: MAX_REVIEWS_PER_BUSINESS,
      syncInfo: null,
      fallback: true,
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureGbpTables();
    const body = await request.json();

    if (body.kind === 'save-sheet') {
      const sheetId = await saveGbpSheetConfig(String(body.sheetUrl || ''));
      if (!sheetId) {
        const result = await syncGbpReviews();
        const syncInfo = await getGbpSyncInfo();
        return NextResponse.json({
          success: true,
          cleared: true,
          ...result,
          message: 'สลับกลับไปใช้การดึงอัตโนมัติจาก Google Maps API โดยตรงแล้ว',
          syncInfo,
        });
      }
      const result = await syncPorterGbpSheet();
      const syncInfo = await getGbpSyncInfo();
      return NextResponse.json(
        {
          success: result.ok,
          ...result,
          syncInfo,
        },
        { status: result.ok ? 200 : 400 }
      );
    }

    if (body.kind === 'sync-sheet') {
      const result = await syncGbpReviews();
      const syncInfo = await getGbpSyncInfo();
      return NextResponse.json(
        { success: result.ok, ...result, syncInfo },
        { status: result.ok ? 200 : 400 }
      );
    }

    const id = `rev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const locationId = body.locationId || 'loc-car';
    const reviewerName = (body.reviewerName || '').trim() || 'ลูกค้า Google Maps';
    const rating = Math.min(5, Math.max(1, Number(body.rating) || 5));
    const comment = (body.comment || '').trim();
    const reviewDate = body.reviewDate || new Date().toISOString().slice(0, 10);
    const replyText = (body.replyText || '').trim();
    const repliedBy = (body.repliedBy || '').trim();

    await prisma.$executeRawUnsafe(
      `INSERT INTO "GbpReview" (
        "id", "locationId", "reviewerName", "rating", "comment",
        "reviewDate", "replyText", "repliedBy", "source"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Manual');`,
      id,
      locationId,
      reviewerName,
      rating,
      comment,
      reviewDate,
      replyText,
      repliedBy
    );

    await prisma.$executeRawUnsafe(
      `UPDATE "GbpLocation"
       SET "totalReviews" = "totalReviews" + 1,
           "repliedCount" = "repliedCount" + $2,
           "lastReviewAt" = GREATEST("lastReviewAt", $3),
           "updatedAt" = CURRENT_TIMESTAMP
       WHERE "id" = $1;`,
      locationId,
      replyText ? 1 : 0,
      reviewDate
    );

    return NextResponse.json({ success: true, id });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to process request';
    console.error('Error in GBP POST:', msg);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    await ensureGbpTables();
    const body = await request.json();

    if (body.kind === 'review-reply') {
      const { id, replyText, repliedBy } = body;
      if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

      const nextReply = (replyText || '').trim();
      const nextRepliedBy = (repliedBy || '').trim();

      await prisma.$executeRawUnsafe(
        `INSERT INTO "GbpReview" (
          "id", "locationId", "reviewerName", "rating", "comment",
          "reviewDate", "replyText", "repliedBy", "source"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT ("id") DO UPDATE
        SET "replyText" = EXCLUDED."replyText",
            "repliedBy" = EXCLUDED."repliedBy";`,
        id,
        body.locationId || 'loc-car',
        body.reviewerName || 'ลูกค้า Google Maps',
        Number(body.rating) || 5,
        body.comment || '',
        body.reviewDate || new Date().toISOString().slice(0, 10),
        nextReply,
        nextRepliedBy,
        body.source || 'Google Maps API'
      );

      return NextResponse.json({ success: true });
    }

    if (body.kind === 'location') {
      const { id, rating, totalReviews, repliedCount, lastReviewAt } = body;
      if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });
      await prisma.$executeRawUnsafe(
        `UPDATE "GbpLocation"
         SET "rating" = $2,
             "totalReviews" = $3,
             "repliedCount" = $4,
             "lastReviewAt" = $5,
             "updatedAt" = CURRENT_TIMESTAMP
         WHERE "id" = $1;`,
        id,
        Number(rating) || 5.0,
        Number(totalReviews) || 0,
        Number(repliedCount) || 0,
        lastReviewAt || ''
      );
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid update kind' }, { status: 400 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to update item';
    console.error('Error updating GBP item:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await ensureGbpTables();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    await prisma.$executeRawUnsafe(`DELETE FROM "GbpReview" WHERE "id" = $1;`, id);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to delete review';
    console.error('Error deleting GBP review:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
