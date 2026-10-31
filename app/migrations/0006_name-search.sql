-- The name to find a customer at the register (core/search.ts): lowercase, without accents.
-- Nullable, so the previous version of the app keeps signing customers up while this is published.
-- Existing customers get it here. SQLite's lower() only knows ASCII: accents are replaced first, by hand,
-- with the ones Spanish, Portuguese and Italian names use.
ALTER TABLE `customers` ADD `name_search` text;--> statement-breakpoint
UPDATE `customers` SET `name_search` = lower(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(trim(`name`), 'á', 'a'), 'é', 'e'), 'í', 'i'), 'ó', 'o'), 'ú', 'u'), 'ü', 'u'), 'ñ', 'n'), 'à', 'a'), 'è', 'e'), 'ì', 'i'), 'ò', 'o'), 'ù', 'u'), 'ç', 'c'), 'Á', 'a'), 'É', 'e'), 'Í', 'i'), 'Ó', 'o'), 'Ú', 'u'), 'Ü', 'u'), 'Ñ', 'n'), 'À', 'a'), 'È', 'e'), 'Ì', 'i'), 'Ò', 'o'), 'Ù', 'u'), 'Ç', 'c'));
