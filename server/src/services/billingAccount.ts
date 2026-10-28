/**
 * Billing-account state rules shared by the admin and self-serve routes.
 */

/** Subscription status after a plan change. A delinquency survives it (billing
 *  audit G2: an admin plan change used to force 'active', which re-opened
 *  filing and dropped the org out of the retry sweep). A cancelled account is
 *  reactivated; otherwise the card decides. */
export function statusAfterPlanChange(existing: { status: string; defaultPaymentMethodId: string | null } | null): string {
  if (existing?.status === 'delinquent') return 'delinquent';
  return existing?.defaultPaymentMethodId ? 'card_on_file' : 'active';
}
