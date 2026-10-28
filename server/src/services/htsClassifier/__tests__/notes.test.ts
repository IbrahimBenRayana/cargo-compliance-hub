/**
 * Legal notes given to the AI: the right chapters, the right parts, within budget.
 */
import { describe, it, expect } from 'vitest';
import { headingNotes, lineNotes, splitChapterNotes } from '../notes.js';

describe('splitChapterNotes', () => {
  it('separates legal notes from subheading, additional U.S. and statistical notes', () => {
    const parts = splitChapterNotes(
      'TOYS Notes\n1. This chapter does not cover:\n(a) Candles (heading 3406);\nNotes (con.)\n2. In heading 9503 ...\nSubheading Note\n1. Subheading 9504.50 covers ...\nAdditional U.S. Notes\n1. For heading 9503 ...\nAdditional U.S. Notes (con.)\n2. More.\nStatistical Note\n1. For 9503.00.0073 ...',
    );
    expect(parts.legal).toContain('1. This chapter does not cover:');
    expect(parts.legal).toContain('2. In heading 9503');
    expect(parts.legal).not.toMatch(/con\./);
    expect(parts.subheading).toContain('Subheading 9504.50');
    expect(parts.additional).toContain('1. For heading 9503');
    expect(parts.additional).toContain('2. More.');
    expect(parts.statistical).toContain('9503.00.0073');
  });
});

describe('headingNotes', () => {
  it('gives the section and chapter legal notes of each candidate chapter, once', () => {
    const text = headingNotes(['3924', '3926', '9503']);
    expect(text).toMatch(/Section VII notes/);
    expect(text).toMatch(/Chapter 39 notes/);
    expect(text).toMatch(/Chapter 95 notes/);
    expect(text.match(/Chapter 39 notes/g)).toHaveLength(1);
    // chapter 95 note 1: its exclusions
    expect(text).toContain('Candles (heading 3406)');
    // heading step: no statistical notes
    expect(text).not.toMatch(/Statistical Note/);
  });

  it('stays within the budget, keeping notes that name a candidate heading', () => {
    const text = headingNotes(['8471', '8517', '8543'], 6000);
    expect(text.length).toBeLessThanOrEqual(6500);
    expect(text).toMatch(/8471/);
  });

  it('returns nothing for unknown chapters', () => {
    expect(headingNotes(['0000'])).toBe('');
  });
});

describe('lineNotes', () => {
  it('includes the additional U.S. and statistical notes of the chosen chapter', () => {
    const text = lineNotes(['3901']);
    expect(text).toMatch(/Chapter 39 notes/);
    expect(text).toMatch(/3904\.61\.0010/); // a statistical note
  });
});
