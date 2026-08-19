import type { Zoo } from "./zoo-data";

export type ReviewScores = NonNullable<Zoo["scores"]>;

export type UserReview = {
  zooId: string;
  userId: string;
  visitDate: string;
  note: string;
  scores: ReviewScores;
  updatedAt: string;
};

export type ReviewMap = Record<string, UserReview[]>;

export function reviewForUser(reviews: UserReview[] | undefined, userId: string) {
  return reviews?.find((review) => review.userId === userId);
}

export function averageReviewScores(reviews: UserReview[] | undefined): ReviewScores | null {
  if (!reviews?.length) return null;
  const keys = ["overall", "animals", "pretty", "food", "date", "value"] as const;
  return Object.fromEntries(keys.map((key) => [key, reviews.reduce((sum, review) => sum + review.scores[key], 0) / reviews.length])) as ReviewScores;
}

export function normalizeReviewMap(value: unknown, fallbackUserId: string): ReviewMap {
  if (!value || typeof value !== "object") return {};
  const result: ReviewMap = {};
  for (const [zooId, stored] of Object.entries(value as Record<string, unknown>)) {
    const rows = Array.isArray(stored) ? stored : [stored];
    result[zooId] = rows.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const review = item as Partial<UserReview>;
      if (!review.scores) return [];
      return [{ ...review, zooId: review.zooId || zooId, userId: review.userId || fallbackUserId } as UserReview];
    });
  }
  return result;
}

export const REVIEW_STORAGE_KEY = "our-zoo-journal-reviews-v1";
