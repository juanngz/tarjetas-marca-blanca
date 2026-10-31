-- The reward is earned with the last stamp, 8th for take-away and 5th for coffee beans, and used in a later
-- purchase (decided on 08/10/2026; before: 7 and 4). Each card's balance is recounted from its ledger with
-- the new rule, the same count as core/card.ts (cafes/example.ts). An unknown type leaves the balance empty
-- and the migration fails: better that than a made-up balance.
-- A reward already redeemed under the old rule counts against the new one: rewards don't go below zero here,
-- and the ledger takes it back with the next reward. No entry is added, so the version stays the same.
UPDATE `cards` SET
	`stamps` = (
		SELECT count(*) FROM `entries` e
		WHERE e.`card_id` = `cards`.`id` AND e.`type` = 'stamp'
			AND NOT EXISTS (SELECT 1 FROM `entries` u WHERE u.`undoes_id` = e.`id`)
	) % (CASE `cards`.`type` WHEN 'take-away' THEN 8 WHEN 'beans-quarter' THEN 5 WHEN 'beans-half' THEN 5 END),
	`rewards` = max(0, (
		SELECT count(*) FROM `entries` e
		WHERE e.`card_id` = `cards`.`id` AND e.`type` = 'stamp'
			AND NOT EXISTS (SELECT 1 FROM `entries` u WHERE u.`undoes_id` = e.`id`)
	) / (CASE `cards`.`type` WHEN 'take-away' THEN 8 WHEN 'beans-quarter' THEN 5 WHEN 'beans-half' THEN 5 END)
	- (
		SELECT count(*) FROM `entries` e
		WHERE e.`card_id` = `cards`.`id` AND e.`type` = 'redeem'
			AND NOT EXISTS (SELECT 1 FROM `entries` u WHERE u.`undoes_id` = e.`id`)
	))
WHERE EXISTS (SELECT 1 FROM `entries` e WHERE e.`card_id` = `cards`.`id`);
