/**
 * Format a number with K/M/B suffixes for display.
 * Examples: 500 -> "500", 1200 -> "1.2K", 50000 -> "50K",
 * 1500000 -> "1.5M", 2000000000 -> "2B"
 */
export function formatResource(value: number): string {
  if (value === 0) return '0';

  const negative = value < 0;
  const abs = Math.abs(value);
  let result: string;

  if (abs >= 1_000_000_000) {
    result = formatWithSuffix(abs / 1_000_000_000, 'B');
  } else if (abs >= 1_000_000) {
    result = formatWithSuffix(abs / 1_000_000, 'M');
  } else if (abs >= 1_000) {
    result = formatWithSuffix(abs / 1_000, 'K');
  } else {
    result = String(abs);
  }

  return negative ? `-${result}` : result;
}

function formatWithSuffix(n: number, suffix: string): string {
  const rounded = Math.floor(n * 10) / 10;
  const str = rounded % 1 === 0 ? String(rounded) : rounded.toFixed(1);
  return `${str}${suffix}`;
}

/** Format seconds into a human-readable duration string. */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;

  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  }

  if (seconds < 86400) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }

  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  return h > 0 ? `${d}d ${h}h` : `${d}d`;
}
