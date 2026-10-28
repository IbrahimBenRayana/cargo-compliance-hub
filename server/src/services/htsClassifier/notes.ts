/**
 * HTSUS section and chapter notes for the classifier's prompts (spec v3 §2).
 * GRI 1 classifies by "the terms of the headings and any relative section or
 * chapter notes"; the AI gets the notes themselves instead of its memory of them.
 */
import { CHAPTER_NOTES, SECTION_NOTES } from './htsNotes.js';

export interface ChapterNoteParts {
  /** Section/chapter legal notes: scope, exclusions, definitions (decide the heading). */
  legal: string;
  subheading: string;
  additional: string;
  statistical: string;
}

const PART_HEADER = /^(Subheading|Additional U\.S\.|Statistical) Notes?( \(con\.\))?$/;
const CONTINUED = /^Notes?( \(con\.\))?$/;

export function splitChapterNotes(notes: string): ChapterNoteParts {
  const parts: Record<keyof ChapterNoteParts, string[]> = { legal: [], subheading: [], additional: [], statistical: [] };
  let into: keyof ChapterNoteParts = 'legal';
  for (const para of notes.split('\n')) {
    const p = para.trim();
    if (!p || CONTINUED.test(p)) continue;
    const header = PART_HEADER.exec(p);
    if (header) {
      into = header[1] === 'Subheading' ? 'subheading' : header[1] === 'Statistical' ? 'statistical' : 'additional';
      continue;
    }
    parts[into].push(p);
  }
  return {
    legal: parts.legal.join('\n'),
    subheading: parts.subheading.join('\n'),
    additional: parts.additional.join('\n'),
    statistical: parts.statistical.join('\n'),
  };
}

/**
 * Trim a block of notes to `budget` characters, keeping whole numbered notes:
 * first those that name one of `mentions` (headings or chapters), then note 1
 * (usually the exclusions), then the rest in order.
 */
function trimNotes(text: string, mentions: string[], budget: number): string {
  if (text.length <= budget) return text;
  const groups: string[] = [];
  for (const para of text.split('\n')) {
    if (/^\d+\.\s/.test(para) || groups.length === 0) groups.push(para);
    else groups[groups.length - 1] += `\n${para}`;
  }
  const names = (g: string) => mentions.some((m) => new RegExp(`\\b${m}(\\b|\\.)`).test(g));
  const rank = (g: string, i: number) => (names(g) ? 0 : i <= 1 ? 1 : 2);
  const order = groups.map((g, i) => ({ g, i, r: rank(g, i) })).sort((a, b) => a.r - b.r || a.i - b.i);
  const keep = new Set<number>();
  let used = 0;
  const cut = new Map<number, string>();
  for (const { g, i, r } of order) {
    if (used + g.length > budget) {
      // A note that names a candidate is worth its opening even when long.
      if (r === 0 && budget - used > 400) {
        cut.set(i, `${g.slice(0, budget - used - 10)} [...]`);
        used = budget;
      }
      continue;
    }
    keep.add(i);
    used += g.length + 1;
  }
  const out: string[] = [];
  groups.forEach((g, i) => {
    if (keep.has(i)) out.push(g);
    else if (cut.has(i)) out.push(cut.get(i)!);
    else if (out[out.length - 1] !== '[...]') out.push('[...]');
  });
  return out.join('\n');
}

const chapterOf = (heading: string) => heading.slice(0, 2);

/** What a heading or chapter number looks like when a note names it. */
function mentionsFor(headings: string[]): string[] {
  return [...new Set(headings.flatMap((h) => [h.slice(0, 4), `chapter ${Number(chapterOf(h))}`]))];
}

function blocks(headings: string[], pick: (p: ChapterNoteParts) => string[], budget: number): string {
  const chapters = [...new Set(headings.map(chapterOf))].filter((c) => CHAPTER_NOTES[c]);
  if (chapters.length === 0) return '';
  const sections = [...new Set(chapters.map((c) => CHAPTER_NOTES[c].section).filter((s): s is string => !!s))];
  const raw: { title: string; text: string }[] = [];
  for (const s of sections) {
    const text = splitChapterNotes(SECTION_NOTES[s] ?? '').legal;
    if (text.length > 40) raw.push({ title: `Section ${s} notes`, text });
  }
  for (const c of chapters) {
    const text = pick(splitChapterNotes(CHAPTER_NOTES[c].notes)).filter(Boolean).join('\n');
    if (text.length > 40) raw.push({ title: `Chapter ${Number(c)} notes`, text });
  }
  const each = Math.max(1200, Math.floor(budget / Math.max(1, raw.length)));
  const mentions = mentionsFor(headings);
  return raw.map((b) => `${b.title}:\n${trimNotes(b.text, mentions, each)}`).join('\n\n');
}

/** Section and chapter legal notes for the candidate headings (heading step). */
export function headingNotes(headings: string[], budget = 16000): string {
  return blocks(headings, (p) => [p.legal], budget);
}

/** Every note of the chosen headings' chapters and sections (line step). */
export function lineNotes(headings: string[], budget = 24000): string {
  return blocks(headings, (p) => [p.legal, p.subheading && `Subheading notes:\n${p.subheading}`,
    p.additional && `Additional U.S. notes:\n${p.additional}`, p.statistical && `Statistical notes:\n${p.statistical}`], budget);
}
