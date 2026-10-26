"use client";

import * as React from "react";

// ISO 3166-1 alpha-2. Names come from Intl.DisplayNames so nothing is hard-coded twice.
const CODES =
  "AD AE AF AG AI AL AM AO AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GT GU GW GY HK HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW".split(
    " ",
  );

function localeRegion(): string | undefined {
  for (const tag of navigator.languages ?? [navigator.language]) {
    try {
      const region = new Intl.Locale(tag).maximize().region;
      if (region && CODES.includes(region)) return region;
    } catch {
      /* malformed tag */
    }
  }
  return undefined;
}

/**
 * Country select, defaulted from the browser locale (deck §4 field 8).
 * Only rendered client-side (step 2), so ICU name differences can't cause a
 * hydration mismatch.
 */
export function CountrySelect({
  id,
  value,
  onChange,
  className,
  ...aria
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  className?: string;
  "aria-describedby"?: string;
}) {
  const options = React.useMemo(() => {
    let names: Intl.DisplayNames | null = null;
    try {
      names = new Intl.DisplayNames(["en"], { type: "region" });
    } catch {
      names = null;
    }
    return CODES.map((code) => ({ code, name: names?.of(code) ?? code })).sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  // Default once, if the visitor hasn't picked anything.
  const defaulted = React.useRef(false);
  React.useEffect(() => {
    if (defaulted.current || value) return;
    defaulted.current = true;
    const region = localeRegion();
    if (region) onChange(region);
  }, [value, onChange]);

  return (
    <select id={id} name={id} value={value} onChange={(e) => onChange(e.target.value)} className={className} {...aria}>
      <option value="">Choose a country</option>
      {options.map((o) => (
        <option key={o.code} value={o.code}>
          {o.name}
        </option>
      ))}
    </select>
  );
}
