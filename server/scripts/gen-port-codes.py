#!/usr/bin/env python3
"""Regenerate src/data/schedule-d-ports.ts and src/data/schedule-k-ports.ts
from CBP's published port-code appendices (PDF, cbp.gov).

Usage:
  python3 server/scripts/gen-port-codes.py <appendix-e.pdf> <appendix-f.pdf> <prev-appendix-f.pdf> <out-dir>

  appendix-e.pdf  ACE M1 Import Manifest, Appendix E "Schedule D - U.S. CBP Port Codes"
                  https://www.cbp.gov/document/guidance/ace-appendix-e-schedule-d
  appendix-f.pdf  CAMIR Ocean Appendix F "Schedule K - Foreign Port Codes"
                  https://www.cbp.gov/document/guidance/ace-ocean-camir-appendix-f-schedule-k
  prev-appendix-f.pdf  the edition before it (see carried_over)
  out-dir         src/data

Needs poppler's `pdftotext` on PATH. Copies of the PDFs used for the
checked-in lists live in docs/abi-engine/specs/reference-data/.
"""
import json, re, subprocess, sys

APP_E_LABEL = 'ACE M1 Import Manifest Appendix E, Schedule D, February 3, 2026'
APP_E_URL = 'https://www.cbp.gov/sites/default/files/2026-02/ace_appendix_e_schedule_d_feb_3_2026_508c_0.pdf'
APP_F_LABEL = 'CAMIR Ocean Appendix F, Schedule K, July 23, 2026'
APP_F_URL = 'https://www.cbp.gov/sites/default/files/2026-08/26_0814_camir_ocean_appendix_f_foreign_port_codes.pdf'
PREV_F_LABEL = 'April 2, 2026 edition'
PREV_F_URL = 'https://www.cbp.gov/sites/default/files/2026-04/camir_ocean_appendix_f_schedule_k_april_2_2026_508.pdf'

# Census Bureau Schedule D district names, copied from
# https://www.census.gov/foreign-trade/schedules/d/distcode.html (2026-11-11).
# CBP's appendix groups ports by region only; Census is where the district
# names live. Districts Census does not tabulate are named from their first
# port in CBP's list.
CENSUS_DISTRICTS = {
    '01': 'PORTLAND, ME', '02': 'ST. ALBANS, VT', '04': 'BOSTON, MA', '05': 'PROVIDENCE, RI',
    '07': 'OGDENSBURG, NY', '09': 'BUFFALO, NY', '10': 'NEW YORK CITY, NY', '11': 'PHILADELPHIA, PA',
    '13': 'BALTIMORE, MD', '14': 'NORFOLK, VA', '15': 'WILMINGTON, NC', '16': 'CHARLESTON, SC',
    '17': 'SAVANNAH, GA', '18': 'TAMPA, FL', '19': 'MOBILE, AL', '20': 'NEW ORLEANS, LA',
    '21': 'PORT ARTHUR, TX', '23': 'LAREDO, TX', '24': 'EL PASO, TX', '25': 'SAN DIEGO, CA',
    '26': 'NOGALES, AZ', '27': 'LOS ANGELES, CA', '28': 'SAN FRANCISCO, CA', '29': 'COLUMBIA-SNAKE, OR',
    '30': 'SEATTLE, WA', '31': 'ANCHORAGE, AK', '32': 'HONOLULU, HI', '33': 'GREAT FALLS, MT',
    '34': 'PEMBINA, ND', '35': 'MINNEAPOLIS, MN', '36': 'DULUTH, MN', '37': 'MILWAUKEE, WI',
    '38': 'DETROIT, MI', '39': 'CHICAGO, IL', '41': 'CLEVELAND, OH', '45': 'ST LOUIS, MO',
    '49': 'SAN JUAN, PR', '51': 'VIRGIN ISLANDS OF THE UNITED STATES', '52': 'MIAMI, FL',
    '53': 'HOUSTON-GALVESTON, TX', '54': 'WASHINGTON, DC', '55': 'DALLAS/FT. WORTH, TX',
}


def pdf_text(path, mode):
    return subprocess.run(['pdftotext', mode, path, '-'], check=True, capture_output=True, text=True).stdout


def schedule_d(path):
    """Code -> name from Appendix E, minus the codes its change table deactivates."""
    text = pdf_text(path, '-layout')
    changes, listing = text.split('\nPort Codes\n', 1)
    # "Port codes were deactivated: • 2781 – Palm Springs ..." The listing
    # still prints these six; the export appendices (L, AESTIR D) dropped them.
    deact = changes.split('Port codes were deactivated:', 1)[1]
    deactivated = set(re.findall(r'•\s*(\d{4})\s*[–-]', deact))
    ports = {}
    for line in listing.split('\n'):
        m = re.match(r'^\s*(\d{4})\s{2,}(\S.*?)\s*$', line)
        if m and m.group(1) not in deactivated:
            if m.group(1) in ports:
                sys.exit(f'duplicate Schedule D code {m.group(1)}')
            ports[m.group(1)] = m.group(2)
    return ports, sorted(deactivated)


FOOTER = re.compile(r'\s*July \d+, 2026\s+CAMIR Ocean Appendix F.*$')
HEADERS = ('Code Port Name', 'Code Ports by Country', 'Port Name Port Name')


def schedule_k(path):
    """(country, code) -> [names] from the by-country tables of Appendix F.

    The supplemental tables after them (Canadian provinces and Mexican states
    for AMS, Canadian customs offices, cruise-line codes) are not ports and
    are left out. In -raw text a wrapped cell shows up either as text before
    the next row's code or as a line of its own; both are continuations of
    the row above, which already carries the full alias, so they are dropped.
    A code printed with no name (72595, Libya) cannot be labelled and is left
    out.
    """
    lines = [FOOTER.sub('', l).strip() for l in pdf_text(path, '-raw').split('\n')]
    start = next(i for i, l in enumerate(lines) if l == 'Albania' and i > 300)
    rows, skipped, pending = {}, [], []
    country = None
    for i in range(start, len(lines)):
        l = lines[i]
        if not l or l in HEADERS:
            continue
        if l.startswith('Supplemental Schedule K'):
            break
        nxt = next((x for x in lines[i + 1:i + 4] if x), '')
        m = re.fullmatch(r'(?:\D+ )?(\d{5}) (\S.*)', l)
        if m:
            skipped += [(country, c) for c in pending]
            pending.clear()
            rows.setdefault((country, m.group(1)), []).append(' '.join(m.group(2).split()))
        elif re.fullmatch(r'\d{5}', l):
            pending.append(l)
        elif nxt in HEADERS:
            country = l
        elif pending:
            rows.setdefault((country, pending[0]), []).append(l)
            skipped += [(country, c) for c in pending[1:]]
            pending.clear()
        # else: a wrapped continuation of the row above
    return rows, skipped


def carried_over(prev_path, cur_path, rows):
    """Codes the previous edition lists that the current one drops with no
    deletion entry in its change table. The July 2026 edition (rebuilt from
    the Army Corps Q1 2026 spreadsheet) loses Shanghai and Laem Chabang this
    way, so they are kept from the April 2, 2026 edition."""
    current = {code for _, code in rows}
    countries = {c for c, _ in rows}
    deleted = deleted_in_changes(cur_path)
    lines = [l.strip() for l in pdf_text(prev_path, '-raw').split('\n')]
    start = [i for i, l in enumerate(lines) if l == 'Albania'][-1]
    extra, country = {}, None
    for l in lines[start:]:
        if l.startswith('Supplemental Schedule K'):
            break
        if l in countries:
            country = l
            continue
        m = re.fullmatch(r'(\d{5}) (\S.*?)(?:(?:January|February|March|April) \d+, 2026.*)?', l)
        if m and m.group(1) not in current and m.group(1) not in deleted:
            extra.setdefault((country, m.group(1)), []).append(' '.join(m.group(2).split()))
    return extra


def deleted_in_changes(path):
    """Codes listed under a deleted/removed heading in an edition's change table."""
    text = pdf_text(path, '-raw')
    table = text[text.index('Table of Changes', text.index('Table of Changes') + 1):]
    table = table[:table.index('\nAlbania\n')]
    deleted, in_deleted = set(), False
    for l in table.split('\n'):
        if re.search(r'(?i)deleted|removed|remove port', l):
            in_deleted = True
        elif re.search(r'(?i)added|updated|correction|cleaned|renamed|became', l):
            in_deleted = False
        if in_deleted:
            deleted.update(re.findall(r'\b(\d{5})\b', l))
    return deleted


def ts_str(s):
    return "'" + s.replace('\\', '\\\\').replace("'", "\\'") + "'"


def write_schedule_d(out_dir, ports, deactivated):
    out = open(f'{out_dir}/schedule-d-ports.ts', 'w', encoding='utf-8')
    out.write(f'''/**
 * CBP Schedule D: U.S. port codes (4 digits, district + port).
 * GENERATED by server/scripts/gen-port-codes.py. Do not edit by hand.
 *
 * Source: CBP {APP_E_LABEL}
 *   {APP_E_URL}
 *   (copy in docs/abi-engine/specs/reference-data/)
 * Port names are CBP's, verbatim. Left out: {', '.join(deactivated)}, which the
 * appendix's own change table lists as deactivated.
 * District headings are Census Bureau Schedule D district names
 * (census.gov/foreign-trade/schedules/d/distcode.html). Districts Census does
 * not tabulate (46, 47, the 7x region and preclearance codes, 92) are named
 * after their first port here.
 *
 * Used for the ISF US port of arrival and the entry port of entry and port of
 * unlading.
 */

export interface PortOption {{
  value: string;
  label: string;
  keywords?: string[];
}}

export const CBP_PORTS_4DIGIT: PortOption[] = [
''')
    district = None
    for code in sorted(ports):
        if code[:2] != district:
            district = code[:2]
            name = CENSUS_DISTRICTS.get(district) or ports[code]
            out.write(f'  // ── District {district} — {name} ──\n')
        out.write(f'  {{ value: {ts_str(code)}, label: {ts_str(code + " — " + ports[code])} }},\n')
    out.write('];\n\nexport const ENTRY_PORTS = CBP_PORTS_4DIGIT;\n')


def write_schedule_k(out_dir, rows, skipped, extra):
    out = open(f'{out_dir}/schedule-k-ports.ts', 'w', encoding='utf-8')
    out.write(f'''/**
 * CBP Schedule K: foreign port codes (5 digits).
 * GENERATED by server/scripts/gen-port-codes.py. Do not edit by hand.
 *
 * Source: CBP {APP_F_LABEL}
 *   {APP_F_URL}
 *   (copy in docs/abi-engine/specs/reference-data/)
 * One option per code. Where CBP lists several port names under one code they
 * are joined with "; " and every name is a search keyword. Only the
 * by-country port tables are included; the supplemental AMS province/state,
 * Canadian customs-office and cruise-line tables are not ports.
 * Left out: {', '.join(c for _, c in skipped) or 'none'} (printed with no port name).
 * Kept from the {PREV_F_LABEL} ({PREV_F_URL}):
 * {', '.join(sorted(c for _, c in extra))}, which the July edition drops without a deletion entry
 * in its change table. Each carries a comment naming that edition.
 *
 * Used for the ISF-5 foreign port of unlading (CATAIR ISF SF50, qualifier K).
 */

import type {{ PortOption }} from './schedule-d-ports';

export const SCHEDULE_K_PORTS: PortOption[] = [
''')
    # A few codes are printed under two countries (Azores and Portugal, say).
    # They become one option, filed under the first country and naming both.
    codes = {}
    for (ctry, code), names in list(rows.items()) + list(extra.items()):
        entry = codes.setdefault(code, {'countries': [], 'names': []})
        entry['countries'].append(ctry)
        entry['names'] += names
    by_country = {}
    for code, entry in codes.items():
        by_country.setdefault(entry['countries'][0], []).append(code)
    for ctry, entries in by_country.items():
        out.write(f'  // ── {ctry} ──\n')
        for code in sorted(entries):
            uniq = list(dict.fromkeys(codes[code]['names']))
            uniq.sort(key=lambda n: not n.lower().startswith('all other'))
            shown = '; '.join(uniq[:3]) + (f' (+{len(uniq) - 3} more)' if len(uniq) > 3 else '')
            label = f'{code} — {shown}, {" / ".join(codes[code]["countries"])}'
            kw = '' if len(uniq) <= 3 else ', keywords: [' + ', '.join(ts_str(n) for n in uniq[3:]) + ']'
            note = f' // {PREV_F_LABEL}' if any(c == code for _, c in extra) else ''
            out.write(f'  {{ value: {ts_str(code)}, label: {ts_str(label)}{kw} }},{note}\n')
    out.write('];\n')


if __name__ == '__main__':
    app_e, app_f, prev_f, out_dir = sys.argv[1:5]
    d_ports, deactivated = schedule_d(app_e)
    k_rows, k_skipped = schedule_k(app_f)
    k_extra = carried_over(prev_f, app_f, k_rows)
    write_schedule_d(out_dir, d_ports, deactivated)
    write_schedule_k(out_dir, k_rows, k_skipped, k_extra)
    print(json.dumps({'scheduleD': len(d_ports), 'deactivated': deactivated,
                      'scheduleK': len({c for _, c in k_rows} | {c for _, c in k_extra}),
                      'kSkipped': k_skipped, 'kCarriedOver': {c: n for (_, c), n in k_extra.items()}}))
