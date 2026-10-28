/**
 * Which bill type an ISF on file uses. A house bill that just repeats the
 * master bill (accepted by the API and by CBP) is a regular bill: loading it
 * as a house bill made the wizard block every edit (BUG-016).
 */
export function billTypeOf(f: { masterBol?: string | null; houseBol?: string | null }): 'HOUSE' | 'REGULAR' {
  const house = (f.houseBol ?? '').trim().toUpperCase();
  const master = (f.masterBol ?? '').trim().toUpperCase();
  return house && house !== master ? 'HOUSE' : 'REGULAR';
}
