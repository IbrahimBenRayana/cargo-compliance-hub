/**
 * US federal holidays on their OBSERVED dates (5 U.S.C. 6103), as YYYYMMDD.
 *
 * ACE rejects a preliminary statement print date that falls on a weekend or
 * a federal holiday (condition F204 PRELIM STMT DATE IS SAT, SUN, OR HOL).
 * Observed-date rule: a holiday on Saturday is observed the Friday before,
 * one on Sunday the Monday after. A Saturday New Year's Day is therefore
 * observed on December 31 of the PRIOR year, so a year's list can include
 * the next year's New Year observance.
 */

function ymd(year: number, month: number, day: number): string {
  return `${year}${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}`;
}

function observed(year: number, month: number, day: number): string {
  const dow = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const shift = dow === 6 ? -1 : dow === 0 ? 1 : 0;
  const d = new Date(Date.UTC(year, month - 1, day + shift));
  return ymd(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** The nth given weekday (0 = Sunday) of a month; n = -1 means the last. */
function nthWeekday(year: number, month: number, weekday: number, n: number): string {
  if (n === -1) {
    const last = new Date(Date.UTC(year, month, 0));
    const back = (last.getUTCDay() - weekday + 7) % 7;
    return ymd(year, month, last.getUTCDate() - back);
  }
  const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  return ymd(year, month, 1 + ((weekday - first + 7) % 7) + (n - 1) * 7);
}

/** Observed federal holidays falling within the given calendar year. */
export function usFederalHolidays(year: number): string[] {
  const dates = [
    observed(year, 1, 1), // New Year's Day
    nthWeekday(year, 1, 1, 3), // Martin Luther King Jr. Day
    nthWeekday(year, 2, 1, 3), // Washington's Birthday
    nthWeekday(year, 5, 1, -1), // Memorial Day
    observed(year, 6, 19), // Juneteenth
    observed(year, 7, 4), // Independence Day
    nthWeekday(year, 9, 1, 1), // Labor Day
    nthWeekday(year, 10, 1, 2), // Columbus Day
    observed(year, 11, 11), // Veterans Day
    nthWeekday(year, 11, 4, 4), // Thanksgiving Day
    observed(year, 12, 25), // Christmas Day
    observed(year + 1, 1, 1), // next New Year's, observed Dec 31 when it is a Saturday
  ];
  return dates.filter((d) => d.startsWith(String(year))).sort();
}

/** True when the YYYYMMDD date is an observed US federal holiday. */
export function isUsFederalHoliday(yyyymmdd: string): boolean {
  return usFederalHolidays(Number(yyyymmdd.slice(0, 4))).includes(yyyymmdd);
}
