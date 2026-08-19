PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_shared_reviews` (
	`zoo_id` text NOT NULL,
	`visit_date` text DEFAULT '' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`scores_json` text NOT NULL,
	`updated_by_user_id` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`zoo_id`, `updated_by_user_id`)
);
--> statement-breakpoint
INSERT INTO `__new_shared_reviews`("zoo_id", "visit_date", "note", "scores_json", "updated_by_user_id", "updated_at") SELECT "zoo_id", "visit_date", "note", "scores_json", "updated_by_user_id", "updated_at" FROM `shared_reviews`;--> statement-breakpoint
DROP TABLE `shared_reviews`;--> statement-breakpoint
ALTER TABLE `__new_shared_reviews` RENAME TO `shared_reviews`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_shared_reviews_user_id` ON `shared_reviews` (`updated_by_user_id`);--> statement-breakpoint
PRAGMA optimize;
