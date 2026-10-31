-- El libro mayor solo crece: deshacer pasa a ser un movimiento ("deshacer") que dice qué anula (deshace_id).
-- Se van deshecho_cuando y deshecho_por_id: su cuándo y su quién son el cuando y el por_id de la fila nueva.
-- Borrar un cliente deja sus tarjetas sin dueño (cliente_id vacío) en lugar de borrarlas: los movimientos
-- siempre tienen tarjeta y tipo_tarjeta ya no hace falta.
-- Datos que ya existan: cada movimiento deshecho suma su fila "deshacer", y los que habían quedado sin tarjeta
-- (de un cliente borrado) reciben una tarjeta sin dueño de su tipo.
-- defer_foreign_keys: D1 deja que las tablas se apunten entre sí mientras se rearman.
-- Orden: primero se rearma movimientos y después se borra la tarjetas vieja. Al revés, borrarla dispara el
-- "ON DELETE SET NULL" viejo de movimientos y los sellos pierden su tarjeta.
PRAGMA defer_foreign_keys = on;--> statement-breakpoint
CREATE TABLE `__new_tarjetas` (
	`id` text PRIMARY KEY NOT NULL,
	`cliente_id` text,
	`tipo` text NOT NULL,
	`codigo_qr` text NOT NULL,
	`codigo_corto` text NOT NULL,
	FOREIGN KEY (`cliente_id`) REFERENCES `clientes`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_tarjetas` (`id`, `cliente_id`, `tipo`, `codigo_qr`, `codigo_corto`)
SELECT `id`, `cliente_id`, `tipo`, `codigo_qr`, `codigo_corto` FROM `tarjetas`;--> statement-breakpoint
INSERT INTO `__new_tarjetas` (`id`, `cliente_id`, `tipo`, `codigo_qr`, `codigo_corto`)
SELECT 'sin-duenio-' || `id`, NULL, `tipo_tarjeta`, 'sin-duenio-' || `id`, 'sin-duenio-' || `id`
FROM `movimientos` WHERE `tarjeta_id` IS NULL;--> statement-breakpoint
CREATE TABLE `__new_movimientos` (
	`id` text PRIMARY KEY NOT NULL,
	`tarjeta_id` text NOT NULL,
	`tipo` text NOT NULL,
	`deshace_id` text,
	`cuando` integer NOT NULL,
	`por_id` text NOT NULL,
	FOREIGN KEY (`tarjeta_id`) REFERENCES `tarjetas`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`deshace_id`) REFERENCES `movimientos`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`por_id`) REFERENCES `equipo`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "movimientos_tipo" CHECK("tipo" in ('sello', 'canje', 'deshacer')),
	CONSTRAINT "movimientos_deshacer" CHECK(("tipo" = 'deshacer') = ("deshace_id" is not null))
);
--> statement-breakpoint
INSERT INTO `__new_movimientos` (`id`, `tarjeta_id`, `tipo`, `deshace_id`, `cuando`, `por_id`)
SELECT `id`, coalesce(`tarjeta_id`, 'sin-duenio-' || `id`), `tipo`, NULL, `cuando`, `por_id` FROM `movimientos`;--> statement-breakpoint
INSERT INTO `__new_movimientos` (`id`, `tarjeta_id`, `tipo`, `deshace_id`, `cuando`, `por_id`)
SELECT lower(hex(randomblob(16))), coalesce(`tarjeta_id`, 'sin-duenio-' || `id`), 'deshacer', `id`, `deshecho_cuando`, `deshecho_por_id`
FROM `movimientos` WHERE `deshecho_cuando` IS NOT NULL;--> statement-breakpoint
DROP TABLE `movimientos`;--> statement-breakpoint
ALTER TABLE `__new_movimientos` RENAME TO `movimientos`;--> statement-breakpoint
CREATE UNIQUE INDEX `movimientos_deshace_id_unique` ON `movimientos` (`deshace_id`);--> statement-breakpoint
CREATE INDEX `movimientos_tarjeta` ON `movimientos` (`tarjeta_id`);--> statement-breakpoint
CREATE INDEX `movimientos_cuando` ON `movimientos` (`cuando`);--> statement-breakpoint
DROP TABLE `tarjetas`;--> statement-breakpoint
ALTER TABLE `__new_tarjetas` RENAME TO `tarjetas`;--> statement-breakpoint
CREATE UNIQUE INDEX `tarjetas_codigo_qr_unique` ON `tarjetas` (`codigo_qr`);--> statement-breakpoint
CREATE UNIQUE INDEX `tarjetas_codigo_corto_unique` ON `tarjetas` (`codigo_corto`);--> statement-breakpoint
CREATE UNIQUE INDEX `tarjetas_cliente_tipo` ON `tarjetas` (`cliente_id`,`tipo`);--> statement-breakpoint
PRAGMA defer_foreign_keys = off;
