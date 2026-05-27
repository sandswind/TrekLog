const TNG_BASE_STARDATE = 41000.0;
const TNG_BASE_YEAR = 2364;
const UNITS_PER_YEAR = 1000.0;
const UNITS_PER_DAY = UNITS_PER_YEAR / 365.25;

export function toStardate(date: Date = new Date()): string {
  const year = date.getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const dayOfYear = (date.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24);
  const stardate = TNG_BASE_STARDATE + (year - TNG_BASE_YEAR) * UNITS_PER_YEAR + dayOfYear * UNITS_PER_DAY;
  return stardate.toFixed(1);
}

export function stardateLabel(date: Date = new Date()): string {
  return `STARDATE ${toStardate(date)}`;
}

export function generateLogHeader(date: Date = new Date(), logType: string = "Captain's Log"): string {
  return `Stardate ${toStardate(date)}. ${logType}, Supplemental...`;
}

export function formatEarthDate(date: Date = new Date()): string {
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  const y = date.getFullYear();
  const m = months[date.getMonth()];
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}•${m}•${d}`;
}

export function formatEarthDateShort(date: Date = new Date()): string {
  return date.toLocaleDateString('en-US', { month:'short', day:'2-digit', year:'numeric' }).toUpperCase();
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

export function toDateKey(date: Date = new Date()): string {
  return date.toISOString().split('T')[0];
}
