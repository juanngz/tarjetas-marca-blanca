-- Las sesiones pasan a una cookie firmada: se borra la tabla. Ver docs/implementacion/arquitectura.md, "Las sesiones".
-- El equipo entra con email + PIN. El email es único; el nombre ya no (solo se muestra).
-- baja: cuándo dejó de trabajar (vacío: activa). Las personas no se borran, se dan de baja.
-- SQLite no agrega una columna NOT NULL sin valor por defecto: se rearma la tabla.
-- Si ya hay personas cargadas, quedan con un email provisorio "<id>@pendiente.invalid" que hay que cambiar por el real.
-- defer_foreign_keys: D1 deja que movimientos apunte a la tabla mientras se rearma.
DROP TABLE `sesiones`;--> statement-breakpoint
PRAGMA defer_foreign_keys = on;--> statement-breakpoint
CREATE TABLE `__new_equipo` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`nombre` text NOT NULL,
	`rol` text NOT NULL,
	`pin_hmac` text NOT NULL,
	`intentos_fallidos` integer DEFAULT 0 NOT NULL,
	`bloqueado_hasta` integer,
	`baja` integer,
	CONSTRAINT "equipo_rol" CHECK("rol" in ('barista', 'gerente'))
);
--> statement-breakpoint
INSERT INTO `__new_equipo` (`id`, `email`, `nombre`, `rol`, `pin_hmac`, `intentos_fallidos`, `bloqueado_hasta`)
SELECT `id`, `id` || '@pendiente.invalid', `nombre`, `rol`, `pin_hmac`, `intentos_fallidos`, `bloqueado_hasta` FROM `equipo`;--> statement-breakpoint
DROP TABLE `equipo`;--> statement-breakpoint
ALTER TABLE `__new_equipo` RENAME TO `equipo`;--> statement-breakpoint
CREATE UNIQUE INDEX `equipo_email_unique` ON `equipo` (`email`);--> statement-breakpoint
PRAGMA defer_foreign_keys = off;
