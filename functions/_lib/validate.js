export const isUuid = (s) =>
  typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
export const isMoney = (n, min = 1) => Number.isInteger(n) && n >= min && n <= 1e12;
export const isText = (s, max = 80) => typeof s === 'string' && s.trim().length > 0 && s.trim().length <= max;
export const isDay = (n) => Number.isInteger(n) && n >= 1 && n <= 31;
