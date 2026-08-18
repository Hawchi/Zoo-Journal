CREATE TABLE `shared_custom_places` (
	`id` text PRIMARY KEY NOT NULL,
	`place_json` text NOT NULL,
	`created_by_user_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `shared_memories` (
	`id` text PRIMARY KEY NOT NULL,
	`zoo_id` text NOT NULL,
	`visit_date` text DEFAULT '' NOT NULL,
	`caption` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`image_key` text,
	`created_by_user_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_shared_memories_visit_date` ON `shared_memories` (`visit_date`);--> statement-breakpoint
CREATE TABLE `shared_place_states` (
	`zoo_id` text PRIMARY KEY NOT NULL,
	`wished` integer DEFAULT false NOT NULL,
	`visited` integer DEFAULT false NOT NULL,
	`updated_by_user_id` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `shared_reviews` (
	`zoo_id` text PRIMARY KEY NOT NULL,
	`visit_date` text DEFAULT '' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`scores_json` text NOT NULL,
	`updated_by_user_id` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
PRAGMA optimize;
