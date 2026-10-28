/**
 * ISF-10 filing deadline (19 CFR 149.2(b)): 24 hours BEFORE the cargo is
 * laden aboard the vessel at the foreign port, not 24 hours before
 * departure (audit UOP-M1). Filings carry no lading date yet, so the
 * deadline is exact when the filing has an estimated lading date (lading
 * minus 24h); otherwise it is estimated conservatively from the estimated
 * departure, assuming lading LADING_BUFFER_HOURS earlier, so it errs early.
 */
const HOUR = 60 * 60 * 1000;
export const LADING_BUFFER_HOURS = 24;
export const ISF_HOURS_BEFORE_LADING = 24;

export function isfFilingDeadline(estimatedDeparture: Date | string, estimatedLading?: Date | string | null): Date {
  // Exact when the filer gave an estimated lading date: 24h before it.
  if (estimatedLading) return new Date(new Date(estimatedLading).getTime() - ISF_HOURS_BEFORE_LADING * HOUR);
  const etd = new Date(estimatedDeparture).getTime();
  return new Date(etd - (LADING_BUFFER_HOURS + ISF_HOURS_BEFORE_LADING) * HOUR);
}
