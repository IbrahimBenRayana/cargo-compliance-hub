/**
 * Cutover for CBP's Foreign Importer of Record enhancement (19 CFR 141.22,
 * CSMS #70409426): the 15-Record went to ACE CERT on 2026-11-12 and reaches
 * PROD on 2027-01-05. Before that date PROD does not know the record, so we
 * neither send nor require it; from then on every Add/Replace needs it.
 * IOR_DECLARATION_FROM overrides the date if CBP's deployment moves.
 */
import { env } from '../../config/env.js';
import type { CbpEnvironment } from './environment.js';

const CBP_DEPLOYMENT: Record<'CERT' | 'PROD', string> = {
  CERT: '2026-11-12T00:00:00-05:00',
  PROD: '2027-01-05T00:00:00-05:00',
};

/** Is the U.S. IOR declaration mandatory for a transmission at `now`? */
export function iorDeclarationRequired(
  environment: CbpEnvironment,
  now: Date = new Date(),
  override: string = env.IOR_DECLARATION_FROM,
): boolean {
  const from = new Date(override || CBP_DEPLOYMENT[environment === 'PROD' ? 'PROD' : 'CERT']);
  if (Number.isNaN(from.getTime())) throw new Error(`IOR_DECLARATION_FROM is not a date: '${override}'`);
  return now.getTime() >= from.getTime();
}
