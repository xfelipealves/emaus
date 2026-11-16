CREATE TABLE `ai_step` (
	`id` text PRIMARY KEY NOT NULL,
	`church_id` text NOT NULL,
	`run_id` text NOT NULL,
	`seq` integer NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`input_tokens` integer DEFAULT 0 NOT NULL,
	`output_tokens` integer DEFAULT 0 NOT NULL,
	`cache_read_tokens` integer DEFAULT 0 NOT NULL,
	`cache_write_tokens` integer DEFAULT 0 NOT NULL,
	`cost_usd` real DEFAULT 0 NOT NULL,
	`latency_ms` integer NOT NULL,
	`ok` integer NOT NULL,
	`write` integer DEFAULT false NOT NULL,
	`error` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`church_id`) REFERENCES `church`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`run_id`) REFERENCES `ai_run`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ai_step_run_idx` ON `ai_step` (`run_id`);--> statement-breakpoint
CREATE INDEX `ai_step_church_created_idx` ON `ai_step` (`church_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `church` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text DEFAULT 'Minha Igreja' NOT NULL,
	`timezone` text DEFAULT 'America/Sao_Paulo' NOT NULL,
	`care_threshold_days` integer DEFAULT 21 NOT NULL,
	`allow_self_registration` integer DEFAULT true NOT NULL,
	`ai_provider` text,
	`ai_model` text,
	`ai_effort` text,
	`ai_daily_budget_usd` real,
	`ai_user_daily_budget_usd` real,
	`active` integer DEFAULT true NOT NULL,
	`demo` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `church_slug_unique` ON `church` (`slug`);--> statement-breakpoint
CREATE TABLE `platform_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`ai_daily_budget_usd` real,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
DROP INDEX `audit_created_idx`;--> statement-breakpoint
ALTER TABLE `audit_log` ADD `church_id` text REFERENCES church(id) ON DELETE cascade;--> statement-breakpoint
CREATE INDEX `audit_church_created_idx` ON `audit_log` (`church_id`,`created_at`);--> statement-breakpoint
DROP INDEX `event_starts_idx`;--> statement-breakpoint
ALTER TABLE `event` ADD `church_id` text REFERENCES church(id) ON DELETE cascade;--> statement-breakpoint
CREATE INDEX `event_church_starts_idx` ON `event` (`church_id`,`starts_at`);--> statement-breakpoint
DROP INDEX `person_status_idx`;--> statement-breakpoint
ALTER TABLE `person` ADD `church_id` text REFERENCES church(id) ON DELETE cascade;--> statement-breakpoint
CREATE INDEX `person_church_status_idx` ON `person` (`church_id`,`status`);--> statement-breakpoint
ALTER TABLE `ai_conversation` ADD `church_id` text REFERENCES church(id) ON DELETE cascade;--> statement-breakpoint
ALTER TABLE `ai_run` ADD `church_id` text REFERENCES church(id) ON DELETE cascade;--> statement-breakpoint
ALTER TABLE `ai_run` ADD `answer` text;--> statement-breakpoint
ALTER TABLE `ai_run` ADD `rating_note` text;--> statement-breakpoint
ALTER TABLE `ai_run` ADD `reviewed_at` integer;--> statement-breakpoint
CREATE INDEX `ai_run_church_created_idx` ON `ai_run` (`church_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `attendance` ADD `church_id` text REFERENCES church(id) ON DELETE cascade;--> statement-breakpoint
CREATE INDEX `attendance_church_idx` ON `attendance` (`church_id`);--> statement-breakpoint
ALTER TABLE `event_category` ADD `church_id` text REFERENCES church(id) ON DELETE cascade;--> statement-breakpoint
CREATE INDEX `event_category_church_idx` ON `event_category` (`church_id`);--> statement-breakpoint
ALTER TABLE `event_series` ADD `church_id` text REFERENCES church(id) ON DELETE cascade;--> statement-breakpoint
CREATE INDEX `event_series_church_idx` ON `event_series` (`church_id`);--> statement-breakpoint
ALTER TABLE `follow_up` ADD `church_id` text REFERENCES church(id) ON DELETE cascade;--> statement-breakpoint
CREATE INDEX `follow_up_church_idx` ON `follow_up` (`church_id`);--> statement-breakpoint
ALTER TABLE `household` ADD `church_id` text REFERENCES church(id) ON DELETE cascade;--> statement-breakpoint
CREATE INDEX `household_church_idx` ON `household` (`church_id`);--> statement-breakpoint
ALTER TABLE `membership` ADD `church_id` text REFERENCES church(id) ON DELETE cascade;--> statement-breakpoint
CREATE INDEX `membership_church_idx` ON `membership` (`church_id`);--> statement-breakpoint
ALTER TABLE `ministry` ADD `church_id` text REFERENCES church(id) ON DELETE cascade;--> statement-breakpoint
CREATE INDEX `ministry_church_idx` ON `ministry` (`church_id`);--> statement-breakpoint
ALTER TABLE `note` ADD `church_id` text REFERENCES church(id) ON DELETE cascade;--> statement-breakpoint
CREATE INDEX `note_church_idx` ON `note` (`church_id`);--> statement-breakpoint
ALTER TABLE `timeline_event` ADD `church_id` text REFERENCES church(id) ON DELETE cascade;--> statement-breakpoint
CREATE INDEX `timeline_church_idx` ON `timeline_event` (`church_id`);--> statement-breakpoint
ALTER TABLE `user` ADD `church_id` text REFERENCES church(id) ON DELETE cascade;--> statement-breakpoint
ALTER TABLE `user` ADD `platform_admin` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `user_church_idx` ON `user` (`church_id`);--> statement-breakpoint
INSERT INTO `church` (`id`, `slug`, `name`, `timezone`, `care_threshold_days`, `allow_self_registration`, `ai_provider`, `ai_model`, `ai_effort`)
SELECT lower(hex(randomblob(16))), 'principal', `name`, `timezone`, `care_threshold_days`, `allow_self_registration`, `ai_provider`, `ai_model`, `ai_effort`
FROM `church_settings` WHERE `id` = 1;--> statement-breakpoint
INSERT INTO `church` (`id`, `slug`) SELECT lower(hex(randomblob(16))), 'principal'
WHERE NOT EXISTS (SELECT 1 FROM `church`) AND (EXISTS (SELECT 1 FROM `user`) OR EXISTS (SELECT 1 FROM `person`));--> statement-breakpoint
UPDATE `audit_log` SET `church_id` = (SELECT `id` FROM `church` LIMIT 1);--> statement-breakpoint
UPDATE `event` SET `church_id` = (SELECT `id` FROM `church` LIMIT 1);--> statement-breakpoint
UPDATE `person` SET `church_id` = (SELECT `id` FROM `church` LIMIT 1);--> statement-breakpoint
UPDATE `ai_conversation` SET `church_id` = (SELECT `id` FROM `church` LIMIT 1);--> statement-breakpoint
UPDATE `ai_run` SET `church_id` = (SELECT `id` FROM `church` LIMIT 1);--> statement-breakpoint
UPDATE `attendance` SET `church_id` = (SELECT `id` FROM `church` LIMIT 1);--> statement-breakpoint
UPDATE `event_category` SET `church_id` = (SELECT `id` FROM `church` LIMIT 1);--> statement-breakpoint
UPDATE `event_series` SET `church_id` = (SELECT `id` FROM `church` LIMIT 1);--> statement-breakpoint
UPDATE `follow_up` SET `church_id` = (SELECT `id` FROM `church` LIMIT 1);--> statement-breakpoint
UPDATE `household` SET `church_id` = (SELECT `id` FROM `church` LIMIT 1);--> statement-breakpoint
UPDATE `membership` SET `church_id` = (SELECT `id` FROM `church` LIMIT 1);--> statement-breakpoint
UPDATE `ministry` SET `church_id` = (SELECT `id` FROM `church` LIMIT 1);--> statement-breakpoint
UPDATE `note` SET `church_id` = (SELECT `id` FROM `church` LIMIT 1);--> statement-breakpoint
UPDATE `timeline_event` SET `church_id` = (SELECT `id` FROM `church` LIMIT 1);--> statement-breakpoint
UPDATE `user` SET `church_id` = (SELECT `id` FROM `church` LIMIT 1);
