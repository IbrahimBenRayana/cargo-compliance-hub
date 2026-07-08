import { z } from 'zod';

/**
 * Account email input — the single source of truth for how we accept an email
 * that identifies a user (login, registration, admin provisioning, invites).
 *
 * Emails are treated case-insensitively everywhere. We trim surrounding
 * whitespace and lowercase the value so a given address always resolves to the
 * same stored row. Without this, an email persisted with any uppercase letters
 * (e.g. "Foo.Bar@x.com") could only be logged into by typing that exact
 * capitalization — a lowercase attempt missed the case-sensitive lookup and
 * returned a generic 401. Keep every account-email field on this schema.
 *
 * Pair with the `j_lowercase_emails` migration, which lowercases existing rows
 * and adds a unique index on lower(email) so case-only duplicates can't be
 * created going forward.
 */
export const emailField = z.string().trim().toLowerCase().email().max(255);
