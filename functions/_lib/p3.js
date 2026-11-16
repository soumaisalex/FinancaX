export { db } from './users.js';

export const bad = (message, status = 400) =>
  new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'content-type': 'application/json' },
  });

export async function readBody(request) {
  try { return await request.json(); } catch { return null; }
}

export const isInt = (v) => Number.isSafeInteger(v);
export const isDate = (s) =>
  typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
export const isColor = (s) => typeof s === 'string' && /^#[0-9a-fA-F]{6}$/.test(s);
export const cleanText = (s, max) =>
  typeof s === 'string' && s.trim().length > 0 && s.trim().length <= max ? s.trim() : null;
