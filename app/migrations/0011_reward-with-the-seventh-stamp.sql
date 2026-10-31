-- The reward is earned with the stamp before the card's last slot, 7th for take-away and 4th for coffee beans,
-- and used in the next purchase, the last slot (decided on 10/10/2026, like the paper card; before: 8 and 5,
-- migration 0008). Each card's balance is recounted from its ledger with the new rule, the same count as
-- core/card.ts (cafes/example.ts). An unknown type leaves the balance empty and the migration fails: better
-- that than a made-up balance.
-- With fewer stamps per round no card owes a reward: rewards only go up. No entry is added, so the version
-- stays the same.
UPDATE `cards` SET
	`stamps` = (
		SELECT count(*) FROM `entries` e
		WHERE e.`card_id` = `cards`.`id` AND e.`type` = 'stamp'
			AND NOT EXISTS (SELECT 1 FROM `entries` u WHERE u.`undoes_id` = e.`id`)
	) % (CASE `cards`.`type` WHEN 'take-away' THEN 7 WHEN 'beans-quarter' THEN 4 WHEN 'beans-half' THEN 4 END),
	`rewards` = max(0, (
		SELECT count(*) FROM `entries` e
		WHERE e.`card_id` = `cards`.`id` AND e.`type` = 'stamp'
			AND NOT EXISTS (SELECT 1 FROM `entries` u WHERE u.`undoes_id` = e.`id`)
	) / (CASE `cards`.`type` WHEN 'take-away' THEN 7 WHEN 'beans-quarter' THEN 4 WHEN 'beans-half' THEN 4 END)
	- (
		SELECT count(*) FROM `entries` e
		WHERE e.`card_id` = `cards`.`id` AND e.`type` = 'redeem'
			AND NOT EXISTS (SELECT 1 FROM `entries` u WHERE u.`undoes_id` = e.`id`)
	))
WHERE EXISTS (SELECT 1 FROM `entries` e WHERE e.`card_id` = `cards`.`id`);
