CREATE TABLE `unknown_email_attempts` (
	`email_hmac` text PRIMARY KEY NOT NULL,
	`failed_attempts` integer DEFAULT 0 NOT NULL,
	`locked_until` integer
);
