-- Who changed each staff member, what and when, from the Equipo screen (decided on 08/10/2026).
-- Never the PIN or the values. by_id empty: the developers, with scripts/staff.mjs. A new table: the
-- previous version of the app doesn't use it, so it keeps working while this one is published.
CREATE TABLE `staff_audit` (
	`id` text PRIMARY KEY NOT NULL,
	`staff_id` text NOT NULL,
	`by_id` text,
	`change` text NOT NULL,
	`at` integer NOT NULL,
	FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`by_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "staff_audit_change" CHECK("staff_audit"."change" in ('added', 'name-changed', 'email-changed', 'pin-reset', 'deactivated', 'reactivated'))
);
--> statement-breakpoint
CREATE INDEX `staff_audit_staff` ON `staff_audit` (`staff_id`);