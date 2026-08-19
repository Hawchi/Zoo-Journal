CREATE TABLE `shared_visits` (
	`zoo_id` text PRIMARY KEY NOT NULL,
	`visit_date` text NOT NULL,
	`start_point` text NOT NULL,
	`distance_km` real DEFAULT 0 NOT NULL,
	`updated_by_user_id` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_shared_visits_visit_date` ON `shared_visits` (`visit_date`);