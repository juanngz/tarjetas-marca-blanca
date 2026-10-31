CREATE TABLE `clientes` (
	`id` text PRIMARY KEY NOT NULL,
	`dni_hmac` text NOT NULL,
	`nombre` text NOT NULL,
	`alta` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `clientes_dni_hmac_unique` ON `clientes` (`dni_hmac`);--> statement-breakpoint
CREATE TABLE `equipo` (
	`id` text PRIMARY KEY NOT NULL,
	`nombre` text NOT NULL,
	`rol` text NOT NULL,
	`pin_hmac` text NOT NULL,
	`intentos_fallidos` integer DEFAULT 0 NOT NULL,
	`bloqueado_hasta` integer,
	CONSTRAINT "equipo_rol" CHECK("equipo"."rol" in ('barista', 'gerente'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `equipo_nombre_unique` ON `equipo` (`nombre`);--> statement-breakpoint
CREATE TABLE `movimientos` (
	`id` text PRIMARY KEY NOT NULL,
	`tarjeta_id` text,
	`tipo_tarjeta` text NOT NULL,
	`tipo` text NOT NULL,
	`cuando` integer NOT NULL,
	`por_id` text NOT NULL,
	`deshecho_cuando` integer,
	`deshecho_por_id` text,
	FOREIGN KEY (`tarjeta_id`) REFERENCES `tarjetas`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`por_id`) REFERENCES `equipo`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`deshecho_por_id`) REFERENCES `equipo`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "movimientos_tipo" CHECK("movimientos"."tipo" in ('sello', 'canje')),
	CONSTRAINT "movimientos_deshecho" CHECK(("movimientos"."deshecho_cuando" is null) = ("movimientos"."deshecho_por_id" is null))
);
--> statement-breakpoint
CREATE INDEX `movimientos_tarjeta` ON `movimientos` (`tarjeta_id`);--> statement-breakpoint
CREATE INDEX `movimientos_cuando` ON `movimientos` (`cuando`);--> statement-breakpoint
CREATE TABLE `sesiones` (
	`id` text PRIMARY KEY NOT NULL,
	`cliente_id` text,
	`equipo_id` text,
	`creada` integer NOT NULL,
	`vence` integer NOT NULL,
	FOREIGN KEY (`cliente_id`) REFERENCES `clientes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`equipo_id`) REFERENCES `equipo`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "sesiones_de_alguien" CHECK(("sesiones"."cliente_id" is null) <> ("sesiones"."equipo_id" is null))
);
--> statement-breakpoint
CREATE INDEX `sesiones_cliente` ON `sesiones` (`cliente_id`);--> statement-breakpoint
CREATE INDEX `sesiones_equipo` ON `sesiones` (`equipo_id`);--> statement-breakpoint
CREATE TABLE `tarjetas` (
	`id` text PRIMARY KEY NOT NULL,
	`cliente_id` text NOT NULL,
	`tipo` text NOT NULL,
	`codigo_qr` text NOT NULL,
	`codigo_corto` text NOT NULL,
	FOREIGN KEY (`cliente_id`) REFERENCES `clientes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tarjetas_codigo_qr_unique` ON `tarjetas` (`codigo_qr`);--> statement-breakpoint
CREATE UNIQUE INDEX `tarjetas_codigo_corto_unique` ON `tarjetas` (`codigo_corto`);--> statement-breakpoint
CREATE UNIQUE INDEX `tarjetas_cliente_tipo` ON `tarjetas` (`cliente_id`,`tipo`);