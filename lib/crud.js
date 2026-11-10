import { TABLES } from './db';
import { toSnake } from './util';

// İstek gövdesinden yalnızca izin verilen sütunları alır. Tablo adı ve sütunlar beyaz listeden gelir.
export function pick(table, body) {
  const cols = TABLES[table];
  if (!cols) return null;
  const data = {};
  for (const [k, v] of Object.entries(body || {})) {
    const s = toSnake(k);
    if (!cols.includes(s)) continue;
    data[s] = s === 'done' ? !!v : String(v == null ? '' : v).slice(0, 20000);
  }
  data.updated_at = new Date().toISOString();
  return data;
}
