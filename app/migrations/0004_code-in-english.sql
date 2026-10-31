-- The code is written in English: tables, columns and stored values too.
-- clientes → customers, equipo → staff, tarjetas → cards, movimientos → entries.
-- Stored values: gerente → manager; grano-cuarto → beans-quarter, grano-medio → beans-half;
-- sello → stamp, canje → redeem, deshacer → undo.
-- Each table is created with its new name, gets its rows copied and the old one is dropped. Ids don't change.
-- defer_foreign_keys: D1 lets the tables point to each other while they're rebuilt.
-- Order: the old ones are dropped from child to parent (entries first), so no ON DELETE fires.
PRAGMA defer_foreign_keys = on;--> statement-breakpoint
CREATE TABLE `customers` (
	`id` text PRIMARY KEY NOT NULL,
	`dni_hmac` text NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `customers` (`id`, `dni_hmac`, `name`, `created_at`)
SELECT `id`, `dni_hmac`, `nombre`, `alta` FROM `clientes`;--> statement-breakpoint
CREATE TABLE `staff` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`pin_hmac` text NOT NULL,
	`failed_attempts` integer DEFAULT 0 NOT NULL,
	`locked_until` integer,
	`deactivated_at` integer,
	CONSTRAINT "staff_role" CHECK("staff"."role" in ('barista', 'manager'))
);
--> statement-breakpoint
INSERT INTO `staff` (`id`, `email`, `name`, `role`, `pin_hmac`, `failed_attempts`, `locked_until`, `deactivated_at`)
SELECT `id`, `email`, `nombre`, CASE `rol` WHEN 'gerente' THEN 'manager' ELSE `rol` END,
	`pin_hmac`, `intentos_fallidos`, `bloqueado_hasta`, `baja`
FROM `equipo`;--> statement-breakpoint
CREATE TABLE `cards` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text,
	`type` text NOT NULL,
	`qr_code` text NOT NULL,
	`short_code` text NOT NULL,
	`stamps` integer DEFAULT 0 NOT NULL,
	`rewards` integer DEFAULT 0 NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `cards` (`id`, `customer_id`, `type`, `qr_code`, `short_code`, `stamps`, `rewards`, `version`)
SELECT `id`, `cliente_id`,
	CASE `tipo` WHEN 'grano-cuarto' THEN 'beans-quarter' WHEN 'grano-medio' THEN 'beans-half' ELSE `tipo` END,
	`codigo_qr`, `codigo_corto`, `sellos`, `premios`, `version`
FROM `tarjetas`;--> statement-breakpoint
CREATE TABLE `entries` (
	`id` text PRIMARY KEY NOT NULL,
	`card_id` text NOT NULL,
	`type` text NOT NULL,
	`undoes_id` text,
	`at` integer NOT NULL,
	`staff_id` text NOT NULL,
	FOREIGN KEY (`card_id`) REFERENCES `cards`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`undoes_id`) REFERENCES `entries`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "entries_type" CHECK("entries"."type" in ('stamp', 'redeem', 'undo')),
	CONSTRAINT "entries_undo" CHECK(("entries"."type" = 'undo') = ("entries"."undoes_id" is not null))
);
--> statement-breakpoint
INSERT INTO `entries` (`id`, `card_id`, `type`, `undoes_id`, `at`, `staff_id`)
SELECT `id`, `tarjeta_id`,
	CASE `tipo` WHEN 'sello' THEN 'stamp' WHEN 'canje' THEN 'redeem' WHEN 'deshacer' THEN 'undo' END,
	`deshace_id`, `cuando`, `por_id`
FROM `movimientos`;--> statement-breakpoint
DROP TABLE `movimientos`;--> statement-breakpoint
DROP TABLE `tarjetas`;--> statement-breakpoint
DROP TABLE `equipo`;--> statement-breakpoint
DROP TABLE `clientes`;--> statement-breakpoint
CREATE UNIQUE INDEX `customers_dni_hmac_unique` ON `customers` (`dni_hmac`);--> statement-breakpoint
CREATE UNIQUE INDEX `staff_email_unique` ON `staff` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `cards_qr_code_unique` ON `cards` (`qr_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `cards_short_code_unique` ON `cards` (`short_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `cards_customer_type` ON `cards` (`customer_id`,`type`);--> statement-breakpoint
CREATE UNIQUE INDEX `entries_undoes_id_unique` ON `entries` (`undoes_id`);--> statement-breakpoint
CREATE INDEX `entries_card` ON `entries` (`card_id`);--> statement-breakpoint
CREATE INDEX `entries_at` ON `entries` (`at`);--> statement-breakpoint
PRAGMA defer_foreign_keys = off;
