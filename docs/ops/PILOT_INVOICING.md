# Invoiced accounts: setup and month-end runbook

Pricing plan v2 §5.1 and §8.2. Invoiced accounts are paid pilots and contracts (US NVOCCs and forwarders).
They are never charged per filing. Each filing CBP accepts is recorded at its locked price. Once a month we
draft one Stripe invoice from those records, and Stripe debits the client's bank account (ACH Direct Debit).

Staging uses Stripe **test mode**. Prod uses live mode, and live mode changes are the founders' call.

## One-time Stripe setup (per Stripe mode)

1. **Payment methods.** In Settings → Payments → Payment methods, turn on **ACH Direct Debit**
   (`us_bank_account`). It uses Financial Connections for instant verification and falls back to
   micro-deposits.
2. **Invoicing.** In Settings → Billing → Invoices, set the business name, address and support email on
   invoices, and turn on invoice reminders (the plan's cadence is days −3, 0, +3 and +7).
3. **Webhook endpoint** (`/api/v1/billing/webhook`). Add these events to the existing four:
   `invoice.finalized`, `invoice.paid`, `invoice.payment_failed`, `invoice.voided` and
   `invoice.marked_uncollectible`.
4. **Customer portal.** Turn on invoice history and payment-method updates, so the client's
   "Invoices & payment methods in Stripe" link shows its invoices.

## Setting up a pilot (in /admin)

1. Provision the org on **ISF + Entry**, or on **ISF Filing** if it files ISFs only.
2. Open ⋯ → **Pricing & billing…** and choose **Invoiced monthly (ACH)**. The pilot terms prefill as a
   $250 monthly minimum that includes 50 accepted ISFs, then $5 per ISF. Match them to the signed order
   form.
   - **Billing starts**: the date of the pilot's first accepted ISF on the production connection, or day
     90 under the one allowed concession. Nothing accepted before this date is invoiced, and a month that
     ends before it carries no minimum.
   - **Entry prices**: only if the order form sells entries. If they're blank, the client can't send
     entries.
3. The client's owner adds a bank account in Settings → Billing → **Add bank account**. Until they do,
   invoices are emailed with a link to pay by ACH, due in 14 days.
4. **First month prepaid** (the default pilot term): open ⋯ → **Usage & invoices…**, pick the first
   month and click **Bill this month's minimum in advance**. That month's usage invoice then leaves the
   minimum out and bills only ISFs above the included count, plus any entries.

## Month end (first working day, UTC months)

1. Open ⋯ → **Usage & invoices…** and pick last month. Check the rated lines against the order form:
   the minimum, ISFs beyond the included count, and entries.
2. Click **Usage CSV** if the client wants the statement with every accepted shipment.
3. Click **Draft usage invoice**. This creates a **draft** in Stripe; nothing is sent yet.
4. Open the draft from the ↗ link. Attach the CSV if wanted, then **Finalize**. Stripe debits the bank
   account or emails the invoice.
5. Credits and goodwill (plan §7.2): add a negative line to the draft before finalizing, and log the
   reason in the billing sheet.

Each month can be invoiced once per kind. If Stripe fails mid-way, the row shows `error`; click again
and the retry re-uses the same Stripe invoice.

## Overdue invoices

Stripe sends the reminders. If an invoice is still unpaid 10 days after its due date (plan §7.3), turn
on **Hold new submissions** in Pricing & billing. Submits then return `402 billing_hold`. Drafts,
amendments and cancellations keep working. Turn the hold off once the invoice is paid.
