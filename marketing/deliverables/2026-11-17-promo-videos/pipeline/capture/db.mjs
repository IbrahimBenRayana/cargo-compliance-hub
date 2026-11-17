// Read-only lookups in the LOCAL promo database (ids change on every reseed).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const REPO = fileURLToPath(new URL('../../../../../', import.meta.url));
const url = fs.readFileSync(`${REPO}server/.env`, 'utf8').match(/^DATABASE_URL="?([^"\n?]+)/m)[1];
if (!url.endsWith('/mycargolens_promo')) throw new Error('promo capture reads the promo database only');

export const sql = (q) => execFileSync('psql', [url, '-Atc', q]).toString().trim();
export const filingId = (masterBol, status) => sql(`select id from filings where master_bol='${masterBol}' and status='${status}' order by created_at limit 1`);
export const entryId = (entryNumber) => sql(`select id from abi_documents where entry_number='${entryNumber}'`);
export const reset = () => execFileSync(fileURLToPath(new URL('../bin/reset.sh', import.meta.url)));
