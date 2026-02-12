import { formatResource, formatDuration } from '../resource-format.ts';

// ---------------------------------------------------------------------------
// formatResource
// ---------------------------------------------------------------------------

describe('formatResource', () => {
  it('returns "0" for zero', () => {
    expect(formatResource(0)).toBe('0');
  });

  it('returns raw number for values below 1000', () => {
    expect(formatResource(500)).toBe('500');
    expect(formatResource(999)).toBe('999');
    expect(formatResource(1)).toBe('1');
  });

  it('formats values in the thousands with K suffix', () => {
    expect(formatResource(1000)).toBe('1K');
    expect(formatResource(1200)).toBe('1.2K');
    expect(formatResource(50000)).toBe('50K');
  });

  it('formats values in the millions with M suffix', () => {
    expect(formatResource(1000000)).toBe('1M');
    expect(formatResource(1500000)).toBe('1.5M');
  });

  it('formats values in the billions with B suffix', () => {
    expect(formatResource(2000000000)).toBe('2B');
    expect(formatResource(1300000000)).toBe('1.3B');
  });

  it('preserves negative sign for values below 1000', () => {
    expect(formatResource(-500)).toBe('-500');
  });

  it('preserves negative sign for suffixed values', () => {
    expect(formatResource(-1200)).toBe('-1.2K');
    expect(formatResource(-2500000)).toBe('-2.5M');
  });

  it('floors the decimal to one place instead of rounding up', () => {
    // 1999 / 1000 = 1.999, floored to 1.9
    expect(formatResource(1999)).toBe('1.9K');
    // 999999 / 1000 = 999.999, floored to 999.9
    expect(formatResource(999999)).toBe('999.9K');
  });

  it('omits the decimal when the value is a whole number after dividing', () => {
    expect(formatResource(5000)).toBe('5K');
    expect(formatResource(3000000)).toBe('3M');
  });
});

// ---------------------------------------------------------------------------
// formatDuration
// ---------------------------------------------------------------------------

describe('formatDuration', () => {
  it('returns seconds only for values under 60', () => {
    expect(formatDuration(0)).toBe('0s');
    expect(formatDuration(45)).toBe('45s');
    expect(formatDuration(59)).toBe('59s');
  });

  it('returns minutes only when seconds remainder is zero', () => {
    expect(formatDuration(60)).toBe('1m');
    expect(formatDuration(120)).toBe('2m');
  });

  it('returns minutes and seconds when there is a remainder', () => {
    expect(formatDuration(90)).toBe('1m 30s');
    expect(formatDuration(150)).toBe('2m 30s');
  });

  it('returns hours only when minutes remainder is zero', () => {
    expect(formatDuration(3600)).toBe('1h');
    expect(formatDuration(7200)).toBe('2h');
  });

  it('returns hours and minutes when there is a remainder', () => {
    expect(formatDuration(3900)).toBe('1h 5m');
    expect(formatDuration(5400)).toBe('1h 30m');
  });

  it('returns days only when hours remainder is zero', () => {
    expect(formatDuration(86400)).toBe('1d');
    expect(formatDuration(172800)).toBe('2d');
  });

  it('returns days and hours when there is a remainder', () => {
    expect(formatDuration(90000)).toBe('1d 1h');
    expect(formatDuration(180000)).toBe('2d 2h');
  });

  it('drops sub-hour remainders when value is in the days range', () => {
    // 86400 + 3600 + 120 = 90120 seconds = 1d 1h (drops the 2 minutes)
    expect(formatDuration(90120)).toBe('1d 1h');
  });
});
