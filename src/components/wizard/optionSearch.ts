/**
 * A port matches when every word typed appears in its code, name or aliases.
 * The default fuzzy match put "Cobb County" above "New York" for "new".
 * Names that start with what was typed come first.
 */
export function matchesEveryWord(value: string, search: string, keywords?: string[]): number {
  const hay = `${value} ${(keywords ?? []).join(' ')}`.toLowerCase();
  const words = search.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.every((w) => hay.includes(w))) return 0;
  const name = value.toLowerCase().split(' — ').pop() ?? '';
  return value.toLowerCase().startsWith(words[0]) || name.startsWith(words[0]) ? 1 : 0.5;
}
