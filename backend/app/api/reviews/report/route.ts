import { corsEmpty, corsJson } from "@/lib/cors";
import { withConnection } from "@/lib/db";

type ReportBody = {
    reviewId?: number;
    userId?: number;
    reason?: string;
};

export async function POST(request: Request) {
    const body: ReportBody = await request.json();
    const reviewId = Number(body.reviewId);
    const userId = Number(body.userId);
    const reason = body.reason?.trim();

    if (!reviewId || !userId) {
        return corsJson(
            { ok: false, message: "리뷰 ID와 사용자 ID가 필요합니다." },
            { status: 400 }
        );
    }

    try {
        const result = await withConnection(async (conn) => {
            const [reviewRows] = await conn.query<{ id: number }[]>(
                "SELECT id FROM reviews WHERE id = ? LIMIT 1",
                [reviewId]
            );
            if (!reviewRows.length) {
                throw new Error("리뷰를 찾을 수 없습니다.");
            }

            const [existing] = await conn.query<{ id: number }[]>(
                "SELECT id FROM review_reports WHERE review_id = ? AND user_id = ? LIMIT 1",
                [reviewId, userId]
            );
            if (existing.length) {
                return { duplicate: true };
            }

            await conn.query(
                `
                INSERT INTO review_reports (review_id, user_id, reason, created_at)
                VALUES (?, ?, ?, NOW())
            `,
                [reviewId, userId, reason ?? null]
            );

            return { duplicate: false };
        });

        if (result.duplicate) {
            return corsJson(
                { ok: false, message: "이미 신고한 리뷰입니다." },
                { status: 409 }
            );
        }

        return corsJson({ ok: true });
    } catch (error) {
        console.error("[reviews/report] error", error);
        return corsJson(
            {
                ok: false,
                message:
                    error instanceof Error ? error.message : "리뷰 신고에 실패했습니다.",
            },
            { status: 500 }
        );
    }
}

export function OPTIONS() {
    return corsEmpty();
}
