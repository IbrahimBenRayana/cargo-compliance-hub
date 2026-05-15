/**
 * FTA preference lookup — STEP-1 ELIGIBILITY ONLY.
 *
 * Given an origin country, returns the FTA / preference programs that
 * include that country. Step 2 — checking whether the specific HTS code
 * qualifies under the program's rules of origin — is the importer's
 * responsibility (and frequently requires a Certificate of Origin from
 * the supplier).
 *
 * The data file lists programs alphabetically; this service returns them
 * filtered + sorted by "broadest scope first" so users see USMCA before
 * Israel-FTA when looking at MX.
 */

import data from '../../data/fta-programs.json' with { type: 'json' };

export interface FtaProgram {
  fullName: string;
  countries: string[];
  covers: string;
  claimCode: string;
  link: string;
}

interface FtaData {
  _meta: { source: string; lastUpdated: string; note: string };
  programs: Record<string, FtaProgram>;
}

const TABLE = data as FtaData;

export interface FtaMatch {
  key:       string;
  fullName:  string;
  covers:    string;
  claimCode: string;
  link:      string;
}

export function lookupFtaForCountry(country: string): FtaMatch[] {
  if (!country) return [];
  const code = country.toUpperCase().slice(0, 2);
  return Object.entries(TABLE.programs)
    .filter(([, p]) => p.countries.includes(code))
    .map(([key, p]) => ({
      key,
      fullName:  p.fullName,
      covers:    p.covers,
      claimCode: p.claimCode,
      link:      p.link,
    }))
    // Broadest-coverage programs first (USMCA before bilateral FTAs).
    .sort((a, b) => b.covers.length - a.covers.length);
}

export function getFtaMeta() {
  return TABLE._meta;
}
