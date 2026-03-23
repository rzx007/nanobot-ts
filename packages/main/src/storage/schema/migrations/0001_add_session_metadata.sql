-- Migration: Add session metadata fields
-- This migration adds metadata fields to the sessions table for multi-session support

-- Add metadata columns to sessions table
ALTER TABLE `sessions` ADD COLUMN `name` text;
ALTER TABLE `sessions` ADD COLUMN `title` text;
ALTER TABLE `sessions` ADD COLUMN `tags` text DEFAULT '[]';
ALTER TABLE `sessions` ADD COLUMN `archived` integer DEFAULT 0;
ALTER TABLE `sessions` ADD COLUMN `archived_at` text;
ALTER TABLE `sessions` ADD COLUMN `model` text;
ALTER TABLE `sessions` ADD COLUMN `message_count` integer DEFAULT 0;
ALTER TABLE `sessions` ADD COLUMN `last_active_at` text;
ALTER TABLE `sessions` ADD COLUMN `pinned` integer DEFAULT 0;

-- Create indexes for metadata queries
CREATE INDEX IF NOT EXISTS `sessions_archived_idx` ON `sessions` (`archived`, `last_active_at`);
CREATE INDEX IF NOT EXISTS `sessions_pinned_idx` ON `sessions` (`pinned`, `last_active_at`);
CREATE INDEX IF NOT EXISTS `sessions_model_idx` ON `sessions` (`model`);

-- Note: For SQLite, full-text search on tags can be implemented later using FTS5
-- Currently, we use LIKE for simple tag filtering
