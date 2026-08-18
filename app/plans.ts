export type PackingItem = {
  id: string;
  label: string;
  checked: boolean;
};

export type PlannedTrip = {
  id: string;
  zooId: string;
  date: string;
  leave: string;
  start: string;
  budget: number;
  tickets: "nee" | "ja";
  note: string;
  packing: PackingItem[];
  createdAt: string;
  createdById?: string;
  requestedFromId?: string | null;
  approvalStatus?: "pending" | "approved" | "declined";
  requestApproval?: boolean;
};

export type CoupleProfile = {
  id: string;
  email?: string;
  displayName: string;
  role: "owner" | "partner";
};

export const COUPLE_PROFILE_STORAGE_KEY = "our-zoo-journal-couple-profiles-v1";
export const ACTIVE_PROFILE_STORAGE_KEY = "our-zoo-journal-active-profile-v1";

export const defaultCoupleProfiles: CoupleProfile[] = [
  { id: "paulien", displayName: "Paulien", role: "owner" },
  { id: "partner", displayName: "Yida", role: "partner" },
];

export const PLANS_STORAGE_KEY = "our-zoo-journal-planned-trips-v1";

export const defaultPackingList = (tickets: "nee" | "ja" = "nee"): PackingItem[] => [
  { id: "tickets", label: "Tickets & deal check", checked: tickets === "ja" },
  { id: "camera", label: "Camera opladen", checked: false },
  { id: "snacks", label: "Snacks voor onderweg", checked: false },
  { id: "shoes", label: "Comfortabele schoenen", checked: false },
  { id: "souvenirs", label: "Ruimte voor souvenirs", checked: false },
];
