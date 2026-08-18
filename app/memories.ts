export type UserMemory = {
  id: string;
  zooId: string;
  date: string;
  caption: string;
  note: string;
  imageDataUrl?: string;
  createdAt: string;
};

export const MEMORY_STORAGE_KEY = "our-zoo-journal-memories-v1";
