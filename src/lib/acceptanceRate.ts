/**
 * Share of resolved ISFs that CBP accepted, as a whole percent. Null until at
 * least one is accepted or rejected: there is no rate yet, not a perfect one.
 */
export function acceptanceRate(filings: { status: string }[]): number | null {
  const accepted = filings.filter((f) => f.status === 'accepted').length;
  const rejected = filings.filter((f) => f.status === 'rejected').length;
  const resolved = accepted + rejected;
  return resolved === 0 ? null : Math.round((accepted / resolved) * 100);
}
