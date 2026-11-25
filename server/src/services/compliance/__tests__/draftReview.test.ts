/**
 * Tests for the AI pre-flight review's deterministic parts.
 *
 * Reproduces the Nov 24 2026 staging report on draft ISF MARRTGG55677
 * (disc brake calipers, HTS 8708305080): the drawer showed raw field keys,
 * listed estimated departure as a will-reject ISF-10 element while the
 * validator passed the filing, and told the importer to file EPA 3520-1
 * for brake calipers.
 */

import { describe, it, expect } from 'vitest';
import {
  fieldLabel,
  humanizeFieldKeys,
  renderRuleCheckSection,
  renderPgaSection,
  buildDraftReviewPrompt,
  createLineHumanizer,
  ruleCheckLabels,
} from '../draftReview.js';
import { validateFiling } from '../../validation.js';
import { lookupPgaFlags } from '../pgaFlags.js';

const party = (name: string, country: string) => ({ name, address1: '1 Main St', city: 'City', country });

/** A complete ISF-10 that the validator scores 95: only the departure date is missing. */
function calipersDraft() {
  const future = new Date(Date.now() + 20 * 86_400_000).toISOString();
  return {
    filingType: 'ISF-10',
    status: 'draft',
    masterBol: 'MARRTGG55677',
    houseBol: 'HBL55677',
    scacCode: 'MAEU',
    vesselName: 'MAERSK KENTUCKY',
    voyageNumber: '',
    foreignPortOfUnlading: '2704',
    placeOfDelivery: '2704',
    estimatedDeparture: null,
    estimatedArrival: future,
    importerName: 'Midwest Imports',
    importerNumber: '12-3456789',
    consigneeName: 'Midwest Imports',
    consigneeNumber: '12-3456789',
    manufacturer: party('Ningbo Brake Co', 'CN'),
    seller: party('Ningbo Brake Co', 'CN'),
    buyer: party('Midwest Imports', 'US'),
    shipToParty: party('Midwest Imports', 'US'),
    consolidator: party('Ningbo Consol', 'CN'),
    containerStuffingLocation: party('Ningbo CFS', 'CN'),
    commodities: [{ htsCode: '8708305080', description: 'Disc brake calipers', countryOfOrigin: 'CN' }],
    containers: [{ number: 'MSCU1234567' }],
  };
}

describe('fieldLabel', () => {
  it('uses the ISF form labels for transport fields', () => {
    expect(fieldLabel('estimatedDeparture')).toBe('Est. Departure Date');
    expect(fieldLabel('voyageNumber')).toBe('Voyage Number');
    expect(fieldLabel('foreignPortOfUnlading')).toBe('US Port of Arrival');
    expect(fieldLabel('scacCode')).toBe('SCAC Code');
  });

  it('names commodity lines by their position', () => {
    expect(fieldLabel('commodities[0].description')).toBe('Commodity 1 Description');
    expect(fieldLabel('commodities[2].htsCode')).toBe('Commodity 3 HTS Code');
    expect(fieldLabel('commodities.description')).toBe('Commodity Description');
  });

  it('names party sub-fields after the party card', () => {
    expect(fieldLabel('manufacturer[0].name')).toBe('Manufacturer / Supplier Name');
    expect(fieldLabel('containerStuffingLocation.country')).toBe('Container Stuffing Location Country');
  });

  it('falls back to readable words, never the raw camelCase key', () => {
    expect(fieldLabel('someNewField')).toBe('Some new field');
  });
});

describe('humanizeFieldKeys', () => {
  it('replaces raw keys the model echoes back, with or without backticks', () => {
    const out = humanizeFieldKeys('- **estimatedDeparture** is empty; `voyageNumber` too; commodities.description is vague');
    expect(out).toBe('- **Est. Departure Date** is empty; Voyage Number too; Commodity Description is vague');
  });

  it('leaves ordinary words alone', () => {
    expect(humanizeFieldKeys('The vessel departs soon.')).toBe('The vessel departs soon.');
  });
});

describe('createLineHumanizer', () => {
  it('rewrites keys split across streamed chunks', () => {
    const h = createLineHumanizer();
    const out = [h.push('- **estimated'), h.push('Departure** is empty\n- ok'), h.flush()].join('');
    expect(out).toBe('- **Est. Departure Date** is empty\n- ok');
  });
});

describe('renderRuleCheckSection — validator and review agree', () => {
  it('reports no will-reject issues when the validator has no critical errors', () => {
    const rule = validateFiling(calipersDraft());
    expect(rule.criticalCount).toBe(0);
    expect(rule.score).toBe(95);

    const md = renderRuleCheckSection(rule);
    const willReject = md.split('**2.')[0];
    expect(willReject).toContain('None');
    expect(willReject).toContain('95/100');
    expect(willReject).not.toMatch(/departure/i);
  });

  it('lists the departure date only as a rule-check warning, labelled', () => {
    const md = renderRuleCheckSection(validateFiling(calipersDraft()));
    const warnings = md.split('**2.')[1];
    expect(warnings).toContain('Est. Departure Date');
    expect(md).not.toContain('estimatedDeparture');
    expect(md).not.toMatch(/ISF-10/);
  });

  it('lists every validator critical error under will-reject, and nothing else', () => {
    const draft = { ...calipersDraft(), importerNumber: '', scacCode: 'M1' };
    const rule = validateFiling(draft);
    const md = renderRuleCheckSection(rule);
    const willReject = md.split('**2.')[0];
    const items = willReject.split('\n').filter((l) => l.startsWith('- '));
    expect(items).toHaveLength(rule.criticalCount);
    expect(willReject).toContain('IOR Number (EIN)');
    expect(willReject).toContain('SCAC Code');
  });
});

describe('PGA hints', () => {
  it('does not send brake calipers to EPA 3520-1', () => {
    const flags = lookupPgaFlags('8708305080');
    expect(flags.map((f) => f.action).join(' ')).not.toMatch(/3520/);
    expect(flags.map((f) => f.agency)).toEqual(['DOT-NHTSA']);
  });

  it('keeps EPA 3520-1 for complete vehicles', () => {
    expect(lookupPgaFlags('8703.23.0190').map((f) => f.agency)).toContain('EPA');
  });

  it('phrases the section as checks, not as required forms', () => {
    const md = renderPgaSection([{ hts: '8708305080', description: 'Disc brake calipers' }]);
    expect(md).toContain('Check whether');
    expect(md).not.toMatch(/\brequired\b/i);
    expect(md).not.toMatch(/3520/);
  });

  it('is empty when no commodity has a flag', () => {
    expect(renderPgaSection([{ hts: '3926909985', description: 'Plastic parts' }])).toBe('');
  });
});

describe('buildDraftReviewPrompt', () => {
  it('sends labelled fields and forbids the model from adding will-reject or PGA claims', () => {
    const draft = calipersDraft();
    const prompt = buildDraftReviewPrompt(draft, validateFiling(draft));
    expect(prompt).toMatch(/Empty fields: .*Est\. Departure Date/);
    expect(prompt).not.toContain('estimatedDeparture');
    expect(prompt).not.toContain('voyageNumber');
    expect(prompt).toMatch(/do not write a will-reject section/i);
    expect(prompt).toMatch(/do not name PGA agencies or forms/i);
  });
});

// ─── Nov 25 follow-up: rough edges seen on staging MARRTGG55677 ──────

describe('empty values read as prose', () => {
  it('does not hand the model a quoted "is empty" value; lists empty fields by label instead', () => {
    const draft = calipersDraft();
    const prompt = buildDraftReviewPrompt(draft, validateFiling(draft));
    expect(prompt).not.toContain('"is empty"');
    expect(prompt).toMatch(/Empty fields: .*Voyage Number/);
  });

  it('rewrites a quoted "is empty" the model still produces', () => {
    expect(humanizeFieldKeys('- **Voyage Number**: "is empty". While not an ISF data element, add it.'))
      .toBe('- **Voyage Number** is empty. While not an ISF data element, add it.');
    expect(humanizeFieldKeys('House Bill of Lading: "is empty"')).toBe('House Bill of Lading is empty');
  });

  it('drops the colon before an unquoted "is empty" (seen on staging Nov 25)', () => {
    expect(humanizeFieldKeys('- **Voyage Number**: is empty. Providing this helps tracking.'))
      .toBe('- **Voyage Number** is empty. Providing this helps tracking.');
    expect(humanizeFieldKeys('- **Containers**:  is empty.')).toBe('- **Containers** is empty.');
  });
});

describe('no repeats of fields the rule check already listed', () => {
  it('drops model bullets about a field shown in the rule-check sections', () => {
    const h = createLineHumanizer({ skipLabels: ['Est. Departure Date'] });
    const out = [
      h.push('**4. Improvements**\n- **Est. Departure Date** is empty; add it.\n'),
      h.push('  continuation of that item\n- **Commodity 1 Description**: be more specific\n'),
      h.flush(),
    ].join('');
    expect(out).toBe('**4. Improvements**\n- **Commodity 1 Description**: be more specific\n');
  });

  it('matches the label loosely (Estimated vs Est., raw key)', () => {
    const h = createLineHumanizer({ skipLabels: ['Est. Departure Date'] });
    const out = h.push('1. **Estimated Departure Date**: missing\n2. **estimatedDeparture** missing\n- **Vessel Name** ok\n') + h.flush();
    expect(out).toBe('- **Vessel Name** ok\n');
  });

  it('tells the model which fields are already covered', () => {
    const draft = calipersDraft();
    const prompt = buildDraftReviewPrompt(draft, validateFiling(draft));
    expect(prompt).toMatch(/already listed.*Est\. Departure Date/i);
  });

  it('exposes the labels the rule-check section used', () => {
    expect(ruleCheckLabels(validateFiling(calipersDraft()))).toContain('Est. Departure Date');
  });
});

describe('warnings never say "required"', () => {
  it('rewords a missing-field warning so it does not contradict "do not block sending"', () => {
    const md = renderRuleCheckSection(validateFiling(calipersDraft()));
    const warnings = md.split('**2.')[1];
    expect(warnings).toContain('- **Est. Departure Date**: Missing. Add it if you know it.');
    expect(warnings).not.toMatch(/required/i);
  });

  it('keeps the validator wording for critical errors, and the same blocking count', () => {
    const draft = { ...calipersDraft(), importerNumber: '' };
    const rule = validateFiling(draft);
    const willReject = renderRuleCheckSection(rule).split('**2.')[0];
    expect(willReject).toContain('Importer of Record number is required');
    expect(willReject.split('\n').filter((l) => l.startsWith('- '))).toHaveLength(rule.criticalCount);
  });
});
