-- The 1 kg coffee beans card, added on 14/10/2026 (cafes/example.ts): every customer has every card, so the
-- ones already signed up get it too, empty. Customers who sign up from now on get it with the others.
-- Its codes are made at random with the alphabet of core/codes.ts (6 characters the short one, 24 the QR's),
-- like platform/codes.server.ts. They're unique: if one collided, the migration would fail instead of
-- leaving two cards with the same code.
INSERT INTO `cards` (`id`, `customer_id`, `type`, `qr_code`, `short_code`, `created_at`)
SELECT
	lower(hex(randomblob(16))),
	`customers`.`id`,
	'beans-kilo',
	-- qr_code: 24 characters.
	substr('23456789ABCDEFGHJKMNPQRSTUVWXYZ', abs(random() % 31) + 1, 1) || substr('23456789ABCDEFGHJKMNPQRSTUVWXYZ', abs(random() % 31) + 1, 1) ||
	substr('23456789ABCDEFGHJKMNPQRSTUVWXYZ', abs(random() % 31) + 1, 1) || substr('23456789ABCDEFGHJKMNPQRSTUVWXYZ', abs(random() % 31) + 1, 1) ||
	substr('23456789ABCDEFGHJKMNPQRSTUVWXYZ', abs(random() % 31) + 1, 1) || substr('23456789ABCDEFGHJKMNPQRSTUVWXYZ', abs(random() % 31) + 1, 1) ||
	substr('23456789ABCDEFGHJKMNPQRSTUVWXYZ', abs(random() % 31) + 1, 1) || substr('23456789ABCDEFGHJKMNPQRSTUVWXYZ', abs(random() % 31) + 1, 1) ||
	substr('23456789ABCDEFGHJKMNPQRSTUVWXYZ', abs(random() % 31) + 1, 1) || substr('23456789ABCDEFGHJKMNPQRSTUVWXYZ', abs(random() % 31) + 1, 1) ||
	substr('23456789ABCDEFGHJKMNPQRSTUVWXYZ', abs(random() % 31) + 1, 1) || substr('23456789ABCDEFGHJKMNPQRSTUVWXYZ', abs(random() % 31) + 1, 1) ||
	substr('23456789ABCDEFGHJKMNPQRSTUVWXYZ', abs(random() % 31) + 1, 1) || substr('23456789ABCDEFGHJKMNPQRSTUVWXYZ', abs(random() % 31) + 1, 1) ||
	substr('23456789ABCDEFGHJKMNPQRSTUVWXYZ', abs(random() % 31) + 1, 1) || substr('23456789ABCDEFGHJKMNPQRSTUVWXYZ', abs(random() % 31) + 1, 1) ||
	substr('23456789ABCDEFGHJKMNPQRSTUVWXYZ', abs(random() % 31) + 1, 1) || substr('23456789ABCDEFGHJKMNPQRSTUVWXYZ', abs(random() % 31) + 1, 1) ||
	substr('23456789ABCDEFGHJKMNPQRSTUVWXYZ', abs(random() % 31) + 1, 1) || substr('23456789ABCDEFGHJKMNPQRSTUVWXYZ', abs(random() % 31) + 1, 1) ||
	substr('23456789ABCDEFGHJKMNPQRSTUVWXYZ', abs(random() % 31) + 1, 1) || substr('23456789ABCDEFGHJKMNPQRSTUVWXYZ', abs(random() % 31) + 1, 1) ||
	substr('23456789ABCDEFGHJKMNPQRSTUVWXYZ', abs(random() % 31) + 1, 1) || substr('23456789ABCDEFGHJKMNPQRSTUVWXYZ', abs(random() % 31) + 1, 1),
	-- short_code: 6 characters.
	substr('23456789ABCDEFGHJKMNPQRSTUVWXYZ', abs(random() % 31) + 1, 1) || substr('23456789ABCDEFGHJKMNPQRSTUVWXYZ', abs(random() % 31) + 1, 1) ||
	substr('23456789ABCDEFGHJKMNPQRSTUVWXYZ', abs(random() % 31) + 1, 1) || substr('23456789ABCDEFGHJKMNPQRSTUVWXYZ', abs(random() % 31) + 1, 1) ||
	substr('23456789ABCDEFGHJKMNPQRSTUVWXYZ', abs(random() % 31) + 1, 1) || substr('23456789ABCDEFGHJKMNPQRSTUVWXYZ', abs(random() % 31) + 1, 1),
	unixepoch() * 1000
FROM `customers`
WHERE NOT EXISTS (
	SELECT 1 FROM `cards` WHERE `cards`.`customer_id` = `customers`.`id` AND `cards`.`type` = 'beans-kilo'
);
