/**
 * Tests for lookupPgaFlags and the curated hint table behind it.
 *
 * The table feeds the Risk tab's PGA lookup and the PGA section of the
 * pre-flight review, so a wrong hint is wrong compliance advice. These pin
 * representative HTS codes in each corrected chapter to the agencies that
 * should (and should not) come back, and keep every action conditional.
 */

import { describe, it, expect } from 'vitest';
import pgaData from '../../../data/pga-flags.json' with { type: 'json' };
import { lookupPgaFlags } from '../pgaFlags.js';

const agencies = (hts: string) => lookupPgaFlags(hts).map((f) => f.agency);
const actions = (hts: string) => lookupPgaFlags(hts).map((f) => f.action).join(' ');

describe('pga-flags.json', () => {
  const entries = Object.entries((pgaData as { prefixes: Record<string, { action: string }[]> }).prefixes);

  it('keys every entry by a 2-digit chapter or 4-digit heading', () => {
    for (const [prefix] of entries) expect(prefix).toMatch(/^(\d{2}|\d{4})$/);
  });

  it('phrases every action as conditional on what the item is', () => {
    for (const [prefix, flags] of entries) {
      for (const f of flags) expect(f.action, `${prefix}: ${f.action}`).toMatch(/\bif\b/);
    }
  });

  it('never states a requirement outright', () => {
    for (const [, flags] of entries) {
      for (const f of flags) expect(f.action).not.toMatch(/\brequired\b/i);
    }
  });

  it('ends no action with a period (renderPgaSection adds one)', () => {
    for (const [, flags] of entries) {
      for (const f of flags) expect(f.action).not.toMatch(/\.$/);
    }
  });
});

describe('lookupPgaFlags', () => {
  it('ignores punctuation and needs at least 2 digits', () => {
    expect(lookupPgaFlags('0304.19.0000')).toEqual(lookupPgaFlags('0304190000'));
    expect(lookupPgaFlags('8')).toEqual([]);
    expect(lookupPgaFlags('')).toEqual([]);
  });

  it('prefers the heading over the chapter', () => {
    expect(agencies('0106.20.0000')).toContain('FWS');
    expect(agencies('0102.21.0010')).not.toContain('FWS');
  });

  describe('food and agriculture (ch 01-24)', () => {
    it('sends beef to FSIS, not FDA', () => {
      expect(agencies('0201.30.5000')).toEqual(['USDA-FSIS', 'USDA-APHIS']);
    });

    it('sends frozen fish to FDA and NOAA, with FSIS only for catfish', () => {
      expect(agencies('0304.89.1090')).toEqual(['FDA', 'NOAA-NMFS', 'USDA-FSIS']);
      expect(actions('0304.89.1090')).toMatch(/if the fish is catfish/);
    });

    it('splits shell eggs (AMS) from egg products (FSIS)', () => {
      expect(agencies('0407.21.0000')).toContain('USDA-AMS');
      expect(agencies('0408.99.0000')).toContain('USDA-FSIS');
    });

    it('flags fresh produce for APHIS and FDA', () => {
      expect(agencies('0804.40.0010')).toEqual(['FDA', 'USDA-APHIS', 'USDA-AMS']);
    });

    it('sends wine to TTB but not juice or water', () => {
      expect(agencies('2204.21.5040')).toEqual(['TTB', 'FDA']);
      expect(agencies('2202.99.3700')).toEqual(['FDA']);
    });

    it('covers tobacco (FDA and TTB)', () => {
      expect(agencies('2402.20.8000')).toEqual(['FDA', 'TTB']);
    });
  });

  describe('chemicals (ch 27-38)', () => {
    it('uses TSCA certification for industrial chemicals, not "registration"', () => {
      expect(agencies('2811.19.6190')).toEqual(['EPA', 'DEA']);
      expect(actions('2811.19.6190')).toMatch(/TSCA import certification/);
    });

    it('sends refrigerants to the EPA ODS/HFC program', () => {
      expect(actions('2903.39.2035')).toMatch(/HFC/);
    });

    it('does not call fertilizers EPA-registered', () => {
      expect(actions('3102.30.0000')).not.toMatch(/registration/i);
      expect(agencies('3101.00.0000')).toContain('USDA-APHIS');
    });

    it('sends pesticides to EPA Notice of Arrival, other ch 38 to TSCA only', () => {
      expect(actions('3808.91.5000')).toMatch(/3540-1/);
      expect(actions('3824.99.9297')).not.toMatch(/3540-1|pesticide/i);
    });

    it('sends drugs to FDA and DEA', () => {
      expect(agencies('3004.90.9290')).toEqual(['FDA', 'DEA']);
    });
  });

  describe('tires (ch 40)', () => {
    it('sends new tires to NHTSA but not rubber hoses or gloves', () => {
      expect(agencies('4011.10.1010')).toEqual(['DOT-NHTSA']);
      expect(lookupPgaFlags('4009.11.0000')).toEqual([]);
      expect(lookupPgaFlags('4015.19.0510')).toEqual([]);
    });
  });

  describe('textiles (ch 61-63)', () => {
    it('points apparel at CPSC, not a CBP pseudo-agency', () => {
      expect(agencies('6109.10.0012')).toEqual(['CPSC', 'CPSC']);
      expect(agencies('6204.62.4011')).not.toContain('CBP');
    });
  });

  describe('jewelry (ch 71)', () => {
    it('asks for a Kimberley certificate only for diamonds', () => {
      expect(actions('7102.10.0000')).toMatch(/Kimberley/);
      expect(lookupPgaFlags('7113.19.5000')).toEqual([]);
    });
  });

  describe('machinery (ch 84)', () => {
    it('sends nonroad engines to EPA 3520-21', () => {
      expect(actions('8407.90.1010')).toMatch(/3520-21/);
      expect(actions('8467.81.0000')).toMatch(/chainsaw/);
    });

    it('sends computers to FCC, not EPA', () => {
      expect(agencies('8471.30.0100')).toEqual(['FCC']);
    });

    it('does not flag pumps, valves or bearings', () => {
      expect(lookupPgaFlags('8413.70.2004')).toEqual([]);
      expect(lookupPgaFlags('8481.80.9050')).toEqual([]);
      expect(lookupPgaFlags('8482.10.5044')).toEqual([]);
    });
  });

  describe('electrical (ch 85)', () => {
    it('sends phones to FCC', () => {
      expect(agencies('8517.13.0000')).toEqual(['FCC']);
    });

    it('does not send motors, batteries or wire to FCC', () => {
      expect(lookupPgaFlags('8501.10.4060')).toEqual([]);
      expect(lookupPgaFlags('8507.60.0020')).toEqual([]);
      expect(lookupPgaFlags('8544.42.9090')).toEqual([]);
    });

    it('sends vehicle lighting to NHTSA', () => {
      expect(agencies('8512.20.2040')).toEqual(['DOT-NHTSA']);
    });
  });

  describe('vehicles (ch 87)', () => {
    it('keeps HS-7 and 3520-1 for cars, conditionally', () => {
      expect(agencies('8703.23.0190')).toEqual(['DOT-NHTSA', 'EPA', 'CPSC']);
      expect(actions('8703.23.0190')).toMatch(/3520-1 if/);
    });

    it('lets farm tractors take the nonroad form', () => {
      expect(actions('8701.92.1000')).toMatch(/3520-21 if it is a nonroad/);
    });

    it('sends trailers to NHTSA only and bicycles to CPSC only', () => {
      expect(agencies('8716.39.0090')).toEqual(['DOT-NHTSA']);
      expect(agencies('8712.00.2500')).toEqual(['CPSC']);
    });
  });

  describe('aircraft (ch 88)', () => {
    it('does not invent an FAA import requirement', () => {
      expect(lookupPgaFlags('8807.30.0060')).toEqual([]);
      expect(agencies('8806.21.0000')).toEqual(['FCC']);
    });
  });

  describe('instruments (ch 90)', () => {
    it('sends medical devices to FDA but not cameras or meters', () => {
      expect(agencies('9018.39.0050')).toEqual(['FDA']);
      expect(lookupPgaFlags('9006.59.0000')).toEqual([]);
      expect(lookupPgaFlags('9028.30.0000')).toEqual([]);
    });

    it('does not promise 510(k) for every device', () => {
      expect(actions('9018.90.7580')).toMatch(/unless exempt/);
    });
  });

  describe('arms, furniture, toys, art (ch 93-97)', () => {
    it('keeps the ATF permit, conditionally', () => {
      expect(actions('9303.20.0010')).toMatch(/ATF Form 6 import permit if/);
    });

    it('checks wooden furniture for Lacey and CPSC', () => {
      expect(agencies('9403.60.8081')).toEqual(['CPSC', 'CPSC', 'USDA-APHIS']);
    });

    it('sends toys to CPSC and consoles to FCC', () => {
      expect(agencies('9503.00.0073')).toEqual(['CPSC']);
      expect(agencies('9504.50.0000')).toEqual(['FCC', 'CPSC']);
    });

    it('sends wildlife-made art to FWS', () => {
      expect(agencies('9705.10.0000')).toEqual(['CBP', 'FWS']);
    });
  });
});
