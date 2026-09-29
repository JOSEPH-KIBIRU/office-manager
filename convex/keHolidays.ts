/**
 * Kenya public holidays, computed for any year:
 *  - fixed-date holidays
 *  - Easter-based (Good Friday, Easter Monday) via the Computus algorithm
 *  - Islamic holidays (Eid al-Fitr, Eid al-Adha) via the tabular Hijri calendar
 *
 * Eid dates are the tabular (civil) estimates; Kenya's Chief Kadhi confirms the
 * actual date by moon sighting, so a ±1 day adjustment is possible. Admins can
 * edit any date in Organization settings.
 */

export interface KenyaHoliday {
  date: string; // YYYY-MM-DD
  name: string;
}

const pad = (n: number) => String(n).padStart(2, "0");
const toIso = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

/** Gregorian date of Easter Sunday (Meeus/Jones/Butcher, anonymous Gregorian algorithm). */
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

/** Convert a Hijri (Islamic) date to the Gregorian date (tabular/Kuwaiti algorithm). */
function hijriToGregorian(hy: number, hm: number, hd: number): Date {
  const jd =
    Math.floor((11 * hy + 3) / 30) + 354 * hy + 30 * hm - Math.floor((hm - 1) / 2) + hd + 1948440 - 385;
  let l = jd + 68569;
  const n = Math.floor((4 * l) / 146097);
  l -= Math.floor((146097 * n + 3) / 4);
  const i = Math.floor((4000 * (l + 1)) / 1461001);
  l = l - Math.floor((1461 * i) / 4) + 31;
  const j = Math.floor((80 * l) / 2447);
  const day = l - Math.floor((2447 * j) / 80);
  l = Math.floor(j / 11);
  const month = j + 2 - 12 * l;
  const year = 100 * (n - 49) + i + l;
  return new Date(Date.UTC(year, month - 1, day));
}

const dayMs = 86400000;

/** All Kenya public holidays for a Gregorian year, sorted by date. */
export function kenyaHolidays(year: number): KenyaHoliday[] {
  const out: KenyaHoliday[] = [
    { date: `${year}-01-01`, name: "New Year's Day" },
    { date: `${year}-05-01`, name: "Labour Day" },
    { date: `${year}-06-01`, name: "Madaraka Day" },
    { date: `${year}-10-10`, name: "Huduma Day" },
    { date: `${year}-10-20`, name: "Mashujaa Day" },
    { date: `${year}-12-12`, name: "Jamhuri Day" },
    { date: `${year}-12-25`, name: "Christmas Day" },
    { date: `${year}-12-26`, name: "Utamaduni Day" },
  ];

  const easter = easterSunday(year);
  out.push({ date: toIso(new Date(easter.getTime() - 2 * dayMs)), name: "Good Friday" });
  out.push({ date: toIso(new Date(easter.getTime() + 1 * dayMs)), name: "Easter Monday" });

  // Eid falls once (sometimes twice if it wraps) in a Gregorian year — scan the
  // surrounding Hijri years and keep the ones landing in this year.
  const est = Math.floor(((year - 622) * 33) / 32);
  for (let hy = est - 1; hy <= est + 2; hy++) {
    const fitr = hijriToGregorian(hy, 10, 1); // 1 Shawwal
    if (fitr.getUTCFullYear() === year) out.push({ date: toIso(fitr), name: "Eid al-Fitr" });
    const adha = hijriToGregorian(hy, 12, 10); // 10 Dhul Hijjah
    if (adha.getUTCFullYear() === year) out.push({ date: toIso(adha), name: "Eid al-Adha" });
  }

  const seen = new Set<string>();
  return out
    .filter((h) => (seen.has(h.date) ? false : (seen.add(h.date), true)))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}
