let names: Intl.DisplayNames | null = null;

/** "CN" to "China", in words the browser already knows. The code itself when it does not. */
export function countryName(code: string): string {
  try {
    names ??= new Intl.DisplayNames(['en'], { type: 'region' });
    return names.of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}
