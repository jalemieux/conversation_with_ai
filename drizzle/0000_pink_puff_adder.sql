CREATE TABLE `conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`raw_input` text NOT NULL,
	`augmented_prompt` text NOT NULL,
	`topic_type` text NOT NULL,
	`framework` text NOT NULL,
	`models` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `responses` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`round` integer NOT NULL,
	`model` text NOT NULL,
	`content` text NOT NULL,
	`sources` text,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE no action
);
