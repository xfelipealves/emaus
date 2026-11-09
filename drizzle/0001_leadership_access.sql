ALTER TABLE `church_settings` ADD `allow_self_registration` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `note` ADD `visibility` text DEFAULT 'team' NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `must_change_password` integer DEFAULT false NOT NULL;