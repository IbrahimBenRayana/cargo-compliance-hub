/**
 * Phase 3 certification-scenario harness runner.
 *
 * Every registered scenario runs the full pipeline against the dry-run
 * parameters and diffs byte-for-byte against its reviewed golden:
 *   transmit → golden/scenarios/<id>.golden.txt   (full wire lines)
 *   reject   → golden/scenarios/<id>.rejection.txt (client-side evidence)
 * GOLDEN_UPDATE=1 regenerates; regenerated files must be reviewed line by
 * line against the CBP package before committing.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCENARIOS, DRY_RUN_PARAMS } from '../scenarios/index.js';
import { scenarioTag } from '../envelope/batch.js';
import type { ValidationIssue } from '../validate/entrySummary.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const GOLDEN_DIR = join(HERE, 'golden', 'scenarios');

function goldenCompare(path: string, actual: string): void {
  if (process.env.GOLDEN_UPDATE === '1') {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, actual);
  }
  expect(actual).toBe(readFileSync(path, 'utf8'));
}

describe('certification scenarios (dry run)', () => {
  it('registry ids are unique and three digits', () => {
    const ids = SCENARIOS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^\d{3}$/);
  });

  for (const scenario of SCENARIOS) {
    describe(`${scenario.id} — ${scenario.title}`, () => {
      if (scenario.kind === 'transmit') {
        it('builds the full wire block and matches its golden', async () => {
          const lines = (await scenario.run(DRY_RUN_PARAMS)) as string[];
          expect(lines.length).toBeGreaterThanOrEqual(4); // A + B + … + Y + Z
          for (const line of lines) expect(line).toHaveLength(80);
          // The scenario tag rides in the B-record at position 60.
          const bRecord = lines[1];
          expect(bRecord.startsWith('B')).toBe(true);
          expect(bRecord.slice(59, 59 + 12).trimEnd()).toBe(scenarioTag(scenario.id));
          goldenCompare(join(GOLDEN_DIR, `${scenario.id}.golden.txt`), lines.join('\n') + '\n');
        });
      } else {
        it('is refused client-side with recorded evidence', async () => {
          const issues = (await scenario.run(DRY_RUN_PARAMS)) as ValidationIssue[];
          expect(issues.length).toBeGreaterThan(0);
          const evidence = issues.map((i) => `${i.severity} ${i.field}: ${i.message}`).join('\n') + '\n';
          goldenCompare(join(GOLDEN_DIR, `${scenario.id}.rejection.txt`), evidence);
        });
      }
    });
  }
});
