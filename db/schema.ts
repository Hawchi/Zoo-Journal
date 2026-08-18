import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const coupleSettings = sqliteTable("couple_settings", {
  id: integer("id").primaryKey(),
  ownerUserId: text("owner_user_id").notNull(),
  inviteCode: text("invite_code").notNull().unique(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const coupleMembers = sqliteTable("couple_members", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull().unique(),
  email: text("email").notNull(),
  displayName: text("display_name").notNull(),
  role: text("role", { enum: ["owner", "partner"] }).notNull(),
  joinedAt: text("joined_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const sharedTrips = sqliteTable("shared_trips", {
  id: text("id").primaryKey(),
  zooId: text("zoo_id").notNull(),
  date: text("date").notNull(),
  leaveTime: text("leave_time").notNull(),
  startPoint: text("start_point").notNull(),
  budget: integer("budget").notNull().default(0),
  tickets: text("tickets", { enum: ["nee", "ja"] }).notNull().default("nee"),
  note: text("note").notNull().default(""),
  packingJson: text("packing_json").notNull().default("[]"),
  createdByUserId: text("created_by_user_id").notNull(),
  requestedFromUserId: text("requested_from_user_id"),
  approvalStatus: text("approval_status", { enum: ["pending", "approved", "declined"] }).notNull().default("approved"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_shared_trips_requested_status").on(table.requestedFromUserId, table.approvalStatus),
  index("idx_shared_trips_date").on(table.date),
]);
