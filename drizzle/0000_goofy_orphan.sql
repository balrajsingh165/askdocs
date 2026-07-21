CREATE TABLE `answer_cache` (
	`key` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`question` text NOT NULL,
	`answer` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `answer_cache_user_idx` ON `answer_cache` (`user_id`);--> statement-breakpoint
CREATE TABLE `chunks` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`user_id` text NOT NULL,
	`chunk_index` integer NOT NULL,
	`content` text NOT NULL,
	`embedding` blob NOT NULL,
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `chunks_user_idx` ON `chunks` (`user_id`);--> statement-breakpoint
CREATE INDEX `chunks_document_idx` ON `chunks` (`document_id`);--> statement-breakpoint
CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`filename` text NOT NULL,
	`kind` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`status` text NOT NULL,
	`error` text,
	`chunk_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `documents_user_idx` ON `documents` (`user_id`);--> statement-breakpoint
CREATE TABLE `embedding_cache` (
	`key` text PRIMARY KEY NOT NULL,
	`model` text NOT NULL,
	`embedding` blob NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `rate_limit_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`subject` text NOT NULL,
	`route` text NOT NULL,
	`at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `rate_limit_subject_route_at_idx` ON `rate_limit_events` (`subject`,`route`,`at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL
);
