CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_user_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE TABLE `attendance` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`person_id` text NOT NULL,
	`status` text NOT NULL,
	`method` text DEFAULT 'manual' NOT NULL,
	`recorded_by_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `event`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`person_id`) REFERENCES `person`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`recorded_by_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `attendance_event_person_uq` ON `attendance` (`event_id`,`person_id`);--> statement-breakpoint
CREATE INDEX `attendance_person_idx` ON `attendance` (`person_id`);--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text,
	`entity` text NOT NULL,
	`entity_id` text NOT NULL,
	`action` text NOT NULL,
	`summary` text NOT NULL,
	`before` text,
	`after` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`actor_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `audit_entity_idx` ON `audit_log` (`entity`,`entity_id`);--> statement-breakpoint
CREATE INDEX `audit_created_idx` ON `audit_log` (`created_at`);--> statement-breakpoint
CREATE TABLE `church_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text DEFAULT 'Minha Igreja' NOT NULL,
	`timezone` text DEFAULT 'America/Sao_Paulo' NOT NULL,
	`care_threshold_days` integer DEFAULT 21 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `event` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`category_id` text,
	`series_id` text,
	`starts_at` integer NOT NULL,
	`ends_at` integer,
	`location` text,
	`cancelled` integer DEFAULT false NOT NULL,
	`checkin_token` text NOT NULL,
	`checkin_open` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `event_category`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`series_id`) REFERENCES `event_series`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `event_checkin_token_unique` ON `event` (`checkin_token`);--> statement-breakpoint
CREATE INDEX `event_starts_idx` ON `event` (`starts_at`);--> statement-breakpoint
CREATE INDEX `event_series_idx` ON `event` (`series_id`);--> statement-breakpoint
CREATE TABLE `event_category` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`color` text DEFAULT 'ember' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `event_ministry` (
	`event_id` text NOT NULL,
	`ministry_id` text NOT NULL,
	PRIMARY KEY(`event_id`, `ministry_id`),
	FOREIGN KEY (`event_id`) REFERENCES `event`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`ministry_id`) REFERENCES `ministry`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `event_ministry_ministry_idx` ON `event_ministry` (`ministry_id`);--> statement-breakpoint
CREATE TABLE `event_series` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`category_id` text,
	`recurrence` text NOT NULL,
	`weekday` integer NOT NULL,
	`time` text NOT NULL,
	`duration_minutes` integer DEFAULT 120 NOT NULL,
	`location` text,
	`start_date` text NOT NULL,
	`end_date` text,
	`ministry_ids` text DEFAULT '[]' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `event_category`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `follow_up` (
	`id` text PRIMARY KEY NOT NULL,
	`person_id` text NOT NULL,
	`title` text NOT NULL,
	`kind` text DEFAULT 'call' NOT NULL,
	`assignee_id` text,
	`created_by_id` text,
	`due_date` text,
	`done_at` integer,
	`outcome` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`person_id`) REFERENCES `person`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`assignee_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `follow_up_person_idx` ON `follow_up` (`person_id`);--> statement-breakpoint
CREATE INDEX `follow_up_assignee_idx` ON `follow_up` (`assignee_id`,`done_at`);--> statement-breakpoint
CREATE TABLE `household` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`address` text,
	`phone` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `membership` (
	`id` text PRIMARY KEY NOT NULL,
	`person_id` text NOT NULL,
	`ministry_id` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`person_id`) REFERENCES `person`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`ministry_id`) REFERENCES `ministry`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `membership_person_idx` ON `membership` (`person_id`);--> statement-breakpoint
CREATE INDEX `membership_ministry_idx` ON `membership` (`ministry_id`);--> statement-breakpoint
CREATE TABLE `ministry` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`color` text DEFAULT 'ember' NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `note` (
	`id` text PRIMARY KEY NOT NULL,
	`person_id` text NOT NULL,
	`author_id` text,
	`content` text NOT NULL,
	`pinned` integer DEFAULT false NOT NULL,
	`edited_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`person_id`) REFERENCES `person`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `note_person_idx` ON `note` (`person_id`);--> statement-breakpoint
CREATE TABLE `person` (
	`id` text PRIMARY KEY NOT NULL,
	`full_name` text NOT NULL,
	`preferred_name` text,
	`status` text DEFAULT 'visitor' NOT NULL,
	`gender` text,
	`phone` text,
	`phone_digits` text,
	`email` text,
	`birth_date` text,
	`address` text,
	`household_id` text,
	`household_role` text,
	`first_visit_date` text,
	`member_since` text,
	`how_found` text,
	`status_changed_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `household`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `person_status_idx` ON `person` (`status`);--> statement-breakpoint
CREATE INDEX `person_name_idx` ON `person` (`full_name`);--> statement-breakpoint
CREATE INDEX `person_phone_idx` ON `person` (`phone_digits`);--> statement-breakpoint
CREATE INDEX `person_household_idx` ON `person` (`household_id`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_user_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE TABLE `timeline_event` (
	`id` text PRIMARY KEY NOT NULL,
	`person_id` text NOT NULL,
	`actor_id` text,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`detail` text,
	`occurred_at` integer NOT NULL,
	FOREIGN KEY (`person_id`) REFERENCES `person`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `timeline_person_idx` ON `timeline_event` (`person_id`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`username` text,
	`display_username` text,
	`role` text DEFAULT 'secretary' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`person_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`person_id`) REFERENCES `person`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_username_unique` ON `user` (`username`);--> statement-breakpoint
CREATE TABLE `user_ministry_access` (
	`user_id` text NOT NULL,
	`ministry_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`user_id`, `ministry_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`ministry_id`) REFERENCES `ministry`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
