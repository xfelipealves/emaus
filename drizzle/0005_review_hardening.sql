CREATE TABLE `rate_limit` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`reset_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `ai_conversation` ADD `scope_key` text;--> statement-breakpoint
ALTER TABLE `ai_conversation` ADD `locked_until` integer;--> statement-breakpoint
ALTER TABLE `event` ADD `occurrence_date` text;--> statement-breakpoint
UPDATE `event` SET `occurrence_date` = date(`starts_at` / 1000 - 10800, 'unixepoch') WHERE `series_id` IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `event_series_occurrence_uq` ON `event` (`series_id`,`occurrence_date`);--> statement-breakpoint
ALTER TABLE `event_series` ADD `excluded_dates` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `membership_active_uq` ON `membership` (`person_id`,`ministry_id`) WHERE "membership"."end_date" is null;