CREATE TABLE `ai_conversation` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text DEFAULT 'Nova conversa' NOT NULL,
	`messages` text DEFAULT '[]' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ai_conversation_user_idx` ON `ai_conversation` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `ai_run` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text,
	`user_id` text,
	`model` text NOT NULL,
	`prompt` text NOT NULL,
	`iterations` integer DEFAULT 0 NOT NULL,
	`input_tokens` integer DEFAULT 0 NOT NULL,
	`output_tokens` integer DEFAULT 0 NOT NULL,
	`cache_read_tokens` integer DEFAULT 0 NOT NULL,
	`cache_write_tokens` integer DEFAULT 0 NOT NULL,
	`cost_usd` real DEFAULT 0 NOT NULL,
	`latency_ms` integer DEFAULT 0 NOT NULL,
	`tool_calls` text DEFAULT '[]' NOT NULL,
	`stop_reason` text,
	`error` text,
	`rating` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `ai_conversation`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `ai_run_created_idx` ON `ai_run` (`created_at`);--> statement-breakpoint
CREATE INDEX `ai_run_user_idx` ON `ai_run` (`user_id`);