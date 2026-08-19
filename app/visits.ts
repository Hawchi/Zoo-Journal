export type ZooVisit = {
  zooId: string;
  date: string;
  startPoint: string;
  kilometers: number;
  updatedAt: string;
};

export type VisitMap = Record<string, ZooVisit>;

export const VISITS_STORAGE_KEY = "our-zoo-journal-visits-v1";
