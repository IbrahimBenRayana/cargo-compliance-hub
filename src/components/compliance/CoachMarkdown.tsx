import type { ReactNode } from 'react';

/**
 * Renders the AI coach's markdown: the small subset the prompts in
 * server/src/routes/compliance.ts ask for (bold, `code`, bulleted and
 * numbered lists, section titles). Anything else stays plain text.
 *
 * The text is built into React nodes, never into HTML, so markup in the
 * model's output shows as literal characters. It is re-parsed on every
 * streamed chunk, so a half-arrived `**` or list marker is tolerated: an
 * unclosed bold runs to the end of its line and a bare marker is hidden.
 */

type CoachBlock =
  | { type: 'heading'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: CoachListItem[] };

interface CoachListItem {
  /** "1." for a numbered item (the number the model wrote); null for a bullet. */
  marker: string | null;
  depth: number;
  text: string;
}

const MAX_DEPTH = 2;
const MAX_HEADING_LENGTH = 80;

const RULE = /^\s*([-*_])\1{2,}\s*$/;
const BARE_MARKER = /^\s*(?:[-*•+]|\*\*)\s*$/;
const HASH_HEADING = /^\s*#{1,6}\s+(.+?)\s*#*\s*$/;
// A whole line in bold ("**1. Will-reject issues**"), optionally numbered outside the bold.
const BOLD_HEADING = /^\s*(\d{1,2}[.)]\s+)?\*\*([^*]+?)\*\*:?\s*$/;
// The same section title before its closing ** has streamed in.
const PARTIAL_HEADING = /^\s*\*\*(\d{1,2}[.)]\s[^*]*)\*?$/;
const LIST_ITEM = /^(\s*)(?:[-*•+]|(\d{1,3})[.)])\s+(.*)$/;

function parseCoachMarkdown(text: string): CoachBlock[] {
  const blocks: CoachBlock[] = [];
  let afterBlank = true;

  for (const line of text.replace(/\r/g, '').split('\n')) {
    if (line.trim() === '') {
      afterBlank = true;
      continue;
    }
    if (RULE.test(line) || BARE_MARKER.test(line)) continue;

    const last = blocks[blocks.length - 1];
    const heading = headingText(line);
    const item = heading === null ? LIST_ITEM.exec(line) : null;

    if (heading !== null) {
      blocks.push({ type: 'heading', text: heading });
    } else if (item) {
      const [, indent, number, rest] = item;
      const list = last?.type === 'list' ? last : null;
      const entry: CoachListItem = {
        marker: number ? `${number}.` : null,
        depth: list ? Math.min(MAX_DEPTH, Math.floor(indent.length / 2)) : 0,
        text: rest,
      };
      if (list) list.items.push(entry);
      else blocks.push({ type: 'list', items: [entry] });
    } else if (last?.type === 'list' && !afterBlank) {
      // A wrapped line belongs to the item above it.
      last.items[last.items.length - 1].text += ` ${line.trim()}`;
    } else if (last?.type === 'paragraph' && !afterBlank) {
      last.text += `\n${line.trim()}`;
    } else {
      blocks.push({ type: 'paragraph', text: line.trim() });
    }
    afterBlank = false;
  }

  // An item whose text has not arrived yet ("- **") would show as an empty bullet.
  return blocks
    .map((b) => (b.type === 'list' ? { ...b, items: b.items.filter((i) => hasVisibleText(i.text)) } : b))
    .filter((b) => (b.type === 'list' ? b.items.length > 0 : hasVisibleText(b.text)));
}

function headingText(line: string): string | null {
  const hash = HASH_HEADING.exec(line);
  if (hash) return hash[1].replace(/\*\*/g, '').replace(/:$/, '').trim();

  const bold = BOLD_HEADING.exec(line);
  if (bold) {
    const title = `${bold[1] ?? ''}${bold[2]}`.replace(/:$/, '').trim();
    return title.length <= MAX_HEADING_LENGTH ? title : null;
  }

  const partial = PARTIAL_HEADING.exec(line);
  if (partial && partial[1].length <= MAX_HEADING_LENGTH) return partial[1].trim();
  return null;
}

function hasVisibleText(text: string): boolean {
  return text.replace(/[*`\s]/g, '') !== '';
}

/** Bold, italic and code spans. Unclosed markers style the rest of the line. */
function renderInline(text: string, allowBold = true): ReactNode[] {
  const out: ReactNode[] = [];
  let plain = '';
  let i = 0;
  const flush = () => {
    if (plain) out.push(plain);
    plain = '';
  };

  while (i < text.length) {
    const ch = text[i];

    if (ch === '`') {
      const close = text.indexOf('`', i + 1);
      const end = close === -1 ? text.length : close;
      flush();
      if (end > i + 1) {
        out.push(
          <code key={i} className="rounded bg-muted px-1 py-0.5 font-mono text-[12px]">
            {text.slice(i + 1, end)}
          </code>,
        );
      }
      i = end + 1;
      continue;
    }

    if (ch === '*' && text[i + 1] === '*' && allowBold) {
      const close = text.indexOf('**', i + 2);
      // Still streaming: bold to the end of the line, minus half of a closing "**".
      const end = close === -1 ? text.length : close;
      const inner = close === -1 ? text.slice(i + 2).replace(/\*$/, '') : text.slice(i + 2, end);
      flush();
      if (inner) {
        out.push(
          <strong key={i} className="font-semibold">
            {renderInline(inner, false)}
          </strong>,
        );
      }
      i = end + 2;
      continue;
    }

    if (ch === '*') {
      // Italic only when the asterisks hug the text, so "2 * 3" stays as written.
      const close = text.indexOf('*', i + 1);
      const opens = i + 1 < text.length && !/\s/.test(text[i + 1]);
      if (opens && close > i + 1 && !/\s/.test(text[close - 1])) {
        flush();
        out.push(<em key={i}>{renderInline(text.slice(i + 1, close), false)}</em>);
        i = close + 1;
        continue;
      }
      // A stray asterisk at the end of the line is the start of a marker still arriving.
      if (i === text.length - 1) {
        i++;
        continue;
      }
    }

    plain += ch;
    i++;
  }
  flush();
  return out;
}

function Caret() {
  return (
    <span
      aria-hidden
      data-caret
      className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse rounded-sm bg-muted-foreground align-text-bottom motion-reduce:animate-none"
    />
  );
}

export function CoachMarkdown({ text, streaming = false }: { text: string; streaming?: boolean }) {
  const blocks = parseCoachMarkdown(text);
  const caret = streaming ? <Caret /> : null;

  return (
    <article className="text-[13px] leading-relaxed text-foreground">
      {blocks.map((block, b) => {
        const tail = b === blocks.length - 1 ? caret : null;

        if (block.type === 'heading') {
          return (
            <h3 key={b} className="mb-1.5 mt-5 text-[14px] font-semibold leading-snug first:mt-0">
              {block.text}
              {tail}
            </h3>
          );
        }

        if (block.type === 'paragraph') {
          return (
            <p key={b} className="mt-2 whitespace-pre-line first:mt-0">
              {renderInline(block.text)}
              {tail}
            </p>
          );
        }

        return (
          <ul key={b} className="mt-2 space-y-1.5 first:mt-0">
            {block.items.map((item, n) => (
              <li key={n} className="flex gap-2" style={{ paddingLeft: 4 + item.depth * 16 }}>
                {item.marker ? (
                  <span className="shrink-0 tabular-nums text-muted-foreground">{item.marker}</span>
                ) : (
                  <span aria-hidden className="shrink-0 text-muted-foreground">•</span>
                )}
                <span className="min-w-0">
                  {renderInline(item.text)}
                  {n === block.items.length - 1 ? tail : null}
                </span>
              </li>
            ))}
          </ul>
        );
      })}
      {blocks.length === 0 ? caret : null}
    </article>
  );
}
