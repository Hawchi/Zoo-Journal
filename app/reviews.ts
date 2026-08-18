import type { Zoo } from "./zoo-data";

export type ReviewScores = NonNullable<Zoo["scores"]>;

export type UserReview = {
  zooId: string;
  visitDate: string;
  note: string;
  scores: ReviewScores;
  updatedAt: string;
};

export type ReviewMap = Record<string, UserReview>;

export const REVIEW_STORAGE_KEY = "our-zoo-journal-reviews-v1";

