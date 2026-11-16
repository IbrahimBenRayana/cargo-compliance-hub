/**
 * Importer of Record number formats — Entry Summary Create/Update usage
 * note (f) "Party Reporting" (ESF-143), shared by the 11-Record IOR, the
 * 15-Record Principal on Power of Attorney, and the SE20 PPA/PPT pair
 * (Cargo Release V41.1, SE-64):
 *   34  NNN-NN-NNNN    SSN
 *   EI  NN-NNNNNNN     IRS number, optional 2-char suffix (NN-NNNNNNNss)
 *   ANI YYDDPP-NNNNN   CBP-assigned number
 * The wire pads an EIN without suffix with two spaces (12X field), which
 * the codec's space fill already does.
 */
export type ImporterNumberType = 'EI' | 'ANI' | '34';

/** The number's type and canonical hyphenated form, or null if it fits no format. */
export function canonicalImporterNumber(raw: string): { type: ImporterNumberType; number: string } | null {
  const cleaned = raw.trim().toUpperCase();
  if (/^[0-9]{3}-[0-9]{2}-[0-9]{4}$/.test(cleaned)) return { type: '34', number: cleaned };
  const ani = /^([0-9]{6})-?([0-9]{5})$/.exec(cleaned);
  if (ani) return { type: 'ANI', number: `${ani[1]}-${ani[2]}` };
  const ein = /^([0-9]{2})-?([0-9]{7})([A-Z0-9]{2})?$/.exec(cleaned);
  if (ein) return { type: 'EI', number: `${ein[1]}-${ein[2]}${ein[3] ?? ''}` };
  return null;
}
