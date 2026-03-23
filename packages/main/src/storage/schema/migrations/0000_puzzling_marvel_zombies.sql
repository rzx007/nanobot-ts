CREATE TABLE `session_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_key` text NOT NULL,
	`role` text NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`message_id` text,
	`parts` text,
	`metadata` text,
	`tool_calls` text,
	`tool_call_id` text,
	`model` text,
	`timestamp` text NOT NULL,
	FOREIGN KEY (`session_key`) REFERENCES `sessions`(`key`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_messages_message_id_unique` ON `session_messages` (`message_id`);--> statement-breakpoint
CREATE INDEX `session_messages_session_key_idx` ON `session_messages` (`session_key`);--> statement-breakpoint
CREATE INDEX `session_messages_timestamp_idx` ON `session_messages` (`timestamp`);--> statement-breakpoint
CREATE INDEX `session_messages_session_key_timestamp_idx` ON `session_messages` (`session_key`,`timestamp`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`key` text PRIMARY KEY NOT NULL,
	`channel` text NOT NULL,
	`chat_id` text NOT NULL,
	`last_consolidated` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `sessions_channel_idx` ON `sessions` (`channel`);--> statement-breakpoint
CREATE INDEX `sessions_chat_id_idx` ON `sessions` (`chat_id`);--> statement-breakpoint
CREATE INDEX `sessions_channel_chat_id_idx` ON `sessions` (`channel`,`chat_id`);--> statement-breakpoint
CREATE INDEX `sessions_updated_at_idx` ON `sessions` (`updated_at`);