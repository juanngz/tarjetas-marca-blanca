-- Audit dates: when each row was created (created_at) and when it last changed (updated_at, empty: never).
-- customers already had created_at: it only gets updated_at. cards gets created_at (no updated_at: a card
-- changes only with its entries, and the ledger says when). staff gets both.
-- SQLite doesn't add a NOT NULL column without a default, and a DEFAULT would hide an insert that forgets
-- the date: cards and staff are rebuilt, like in 0001. Existing rows get the best date there is:
-- - cards: their customer's sign-up; without an owner, their first entry; without entries, the migration's.
-- - staff: their first entry; without entries, the migration's.
-- defer_foreign_keys: D1 lets entries point to the tables while they're rebuilt.
PRAGMA defer_foreign_keys = on;--> statement-breakpoint
ALTER TABLE `customers` ADD `updated_at` integer;--> statement-breakpoint
CREATE TABLE `__new_cards` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text,
	`type` text NOT NULL,
	`qr_code` text NOT NULL,
	`short_code` text NOT NULL,
	`stamps` integer DEFAULT 0 NOT NULL,
	`rewards` integer DEFAULT 0 NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_cards` (`id`, `customer_id`, `type`, `qr_code`, `short_code`, `stamps`, `rewards`, `version`, `created_at`)
SELECT `id`, `customer_id`, `type`, `qr_code`, `short_code`, `stamps`, `rewards`, `version`,
	coalesce(
		(SELECT c.`created_at` FROM `customers` c WHERE c.`id` = `cards`.`customer_id`),
		(SELECT min(e.`at`) FROM `entries` e WHERE e.`card_id` = `cards`.`id`),
		unixepoch() * 1000
	)
FROM `cards`;--> statement-breakpoint
DROP TABLE `cards`;--> statement-breakpoint
ALTER TABLE `__new_cards` RENAME TO `cards`;--> statement-breakpoint
CREATE UNIQUE INDEX `cards_qr_code_unique` ON `cards` (`qr_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `cards_short_code_unique` ON `cards` (`short_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `cards_customer_type` ON `cards` (`customer_id`,`type`);--> statement-breakpoint
CREATE TABLE `__new_staff` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`pin_hmac` text NOT NULL,
	`failed_attempts` integer DEFAULT 0 NOT NULL,
	`locked_until` integer,
	`deactivated_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer,
	CONSTRAINT "staff_role" CHECK("role" in ('barista', 'manager'))
);
--> statement-breakpoint
INSERT INTO `__new_staff` (`id`, `email`, `name`, `role`, `pin_hmac`, `failed_attempts`, `locked_until`, `deactivated_at`, `created_at`)
SELECT `id`, `email`, `name`, `role`, `pin_hmac`, `failed_attempts`, `locked_until`, `deactivated_at`,
	coalesce(
		(SELECT min(e.`at`) FROM `entries` e WHERE e.`staff_id` = `staff`.`id`),
		unixepoch() * 1000
	)
FROM `staff`;--> statement-breakpoint
DROP TABLE `staff`;--> statement-breakpoint
ALTER TABLE `__new_staff` RENAME TO `staff`;--> statement-breakpoint
CREATE UNIQUE INDEX `staff_email_unique` ON `staff` (`email`);--> statement-breakpoint
PRAGMA defer_foreign_keys = off;
