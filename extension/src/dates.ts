const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

const pad = (n: number) => String(n).padStart(2, "0");

export const isoDay = (year: number, month: number, day: number) => `${year}-${pad(month)}-${pad(day)}`;

export const localToday = (now = new Date()) => isoDay(now.getFullYear(), now.getMonth() + 1, now.getDate());

/** Returns YYYY-MM-DD, or null if the day does not exist (31 Feb). */
function toIso(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1) return null;
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCMonth() === month - 1 ? isoDay(year, month, day) : null;
}

function monthFromName(name: string): number | null {
  const lower = name.toLowerCase();
  const index = MONTHS.indexOf(lower.slice(0, 3));
  if (index < 0) return null;
  const full = new Intl.DateTimeFormat("en", { month: "long", timeZone: "UTC" })
    .format(new Date(Date.UTC(2000, index, 1)))
    .toLowerCase();
  return full.startsWith(lower) || (lower === "sept" && index === 8) ? index + 1 : null;
}

type Match = { index: number; iso: string | null };

const PATTERNS: { regex: RegExp; read: (m: RegExpExecArray) => string | null }[] = [
  { regex: /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g, read: (m) => toIso(+m[1], +m[2], +m[3]) },
  {
    // Day first, as written in India. Swapped only when it cannot be day first (12/31/2027).
    regex: /\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b/g,
    read: (m) => (+m[2] > 12 ? toIso(+m[3], +m[1], +m[2]) : toIso(+m[3], +m[2], +m[1])),
  },
  {
    regex: /\b(\d{1,2})(?:st|nd|rd|th)?[\s-]+([A-Za-z]{3,9})\.?,?[\s-]+(\d{4})\b/g,
    read: (m) => {
      const month = monthFromName(m[2]);
      return month ? toIso(+m[3], month, +m[1]) : null;
    },
  },
  {
    regex: /\b([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/g,
    read: (m) => {
      const month = monthFromName(m[1]);
      return month ? toIso(+m[3], month, +m[2]) : null;
    },
  },
];

/** Finds full dates (day, month, and year) in text the user highlighted, in reading order. */
export function parseDates(text: string): string[] {
  const matches: Match[] = [];
  for (const { regex, read } of PATTERNS) {
    for (const m of text.matchAll(regex)) matches.push({ index: m.index ?? 0, iso: read(m as RegExpExecArray) });
  }
  const found = matches
    .sort((a, b) => a.index - b.index)
    .map((m) => m.iso)
    .filter((iso): iso is string => iso !== null);
  return [...new Set(found)];
}
