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

export const sharedPlaceStates = sqliteTable("shared_place_states", {
  zooId: text("zoo_id").primaryKey(),
  wished: integer("wished", { mode: "boolean" }).notNull().default(false),
  visited: integer("visited", { mode: "boolean" }).notNull().default(false),
  updatedByUserId: text("updated_by_user_id").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const sharedReviews = sqliteTable("shared_reviews", {
  zooId: text("zoo_id").primaryKey(),
  visitDate: text("visit_date").notNull().default(""),
  note: text("note").notNull().default(""),
  scoresJson: text("scores_json").notNull(),
  updatedByUserId: text("updated_by_user_id").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const sharedMemories = sqliteTable("shared_memories", {
  id: text("id").primaryKey(),
  zooId: text("zoo_id").notNull(),
  visitDate: text("visit_date").notNull().default(""),
  caption: text("caption").notNull(),
  note: text("note").notNull().default(""),
  imageKey: text("image_key"),
  createdByUserId: text("created_by_user_id").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_shared_memories_visit_date").on(table.visitDate),
]);

export const sharedCustomPlaces = sqliteTable("shared_custom_places", {
  id: text("id").primaryKey(),
  placeJson: text("place_json").notNull(),
  createdByUserId: text("created_by_user_id").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
