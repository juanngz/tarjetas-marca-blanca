-- El saldo de cada tarjeta (sellos y premios), copia del libro mayor para leerla rápido, y su versión.
-- Ver plataforma/base/movimientos.server.ts: cada movimiento actualiza el saldo en la misma operación.
ALTER TABLE `tarjetas` ADD `sellos` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `tarjetas` ADD `premios` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `tarjetas` ADD `version` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- El saldo de las tarjetas que ya tienen movimientos, con la misma cuenta que nucleo/tarjeta.ts.
-- Los sellos por vuelta son los de la primera cafetería (hoy cafes/example.ts). Un tipo desconocido deja el saldo
-- vacío y la migración falla: mejor eso que un saldo inventado.
UPDATE `tarjetas` SET
	`sellos` = (
		SELECT count(*) FROM `movimientos` m
		WHERE m.`tarjeta_id` = `tarjetas`.`id` AND m.`tipo` = 'sello'
			AND NOT EXISTS (SELECT 1 FROM `movimientos` d WHERE d.`deshace_id` = m.`id`)
	) % (CASE `tarjetas`.`tipo` WHEN 'take-away' THEN 7 WHEN 'grano-cuarto' THEN 4 WHEN 'grano-medio' THEN 4 END),
	`premios` = (
		SELECT count(*) FROM `movimientos` m
		WHERE m.`tarjeta_id` = `tarjetas`.`id` AND m.`tipo` = 'sello'
			AND NOT EXISTS (SELECT 1 FROM `movimientos` d WHERE d.`deshace_id` = m.`id`)
	) / (CASE `tarjetas`.`tipo` WHEN 'take-away' THEN 7 WHEN 'grano-cuarto' THEN 4 WHEN 'grano-medio' THEN 4 END)
	- (
		SELECT count(*) FROM `movimientos` m
		WHERE m.`tarjeta_id` = `tarjetas`.`id` AND m.`tipo` = 'canje'
			AND NOT EXISTS (SELECT 1 FROM `movimientos` d WHERE d.`deshace_id` = m.`id`)
	),
	`version` = (SELECT count(*) FROM `movimientos` m WHERE m.`tarjeta_id` = `tarjetas`.`id`)
WHERE EXISTS (SELECT 1 FROM `movimientos` m WHERE m.`tarjeta_id` = `tarjetas`.`id`);
