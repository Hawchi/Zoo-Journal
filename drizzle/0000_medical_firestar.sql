CREATE TABLE `couple_members` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`role` text NOT NULL,
	`joined_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `couple_members_user_id_unique` ON `couple_members` (`user_id`);--> statement-breakpoint
CREATE TABLE `couple_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`owner_user_id` text NOT NULL,
	`invite_code` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `couple_settings_invite_code_unique` ON `couple_settings` (`invite_code`);--> statement-breakpoint
CREATE TABLE `shared_trips` (
	`id` text PRIMARY KEY NOT NULL,
	`zoo_id` text NOT NULL,
	`date` text NOT NULL,
	`leave_time` text NOT NULL,
	`start_point` text NOT NULL,
	`budget` integer DEFAULT 0 NOT NULL,
	`tickets` text DEFAULT 'nee' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`packing_json` text DEFAULT '[]' NOT NULL,
	`created_by_user_id` text NOT NULL,
	`requested_from_user_id` text,
	`approval_status` text DEFAULT 'approved' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
