import { neon } from '@neondatabase/serverless';

let _sql = null;
let _ready = null;

export function sql() {
  if (!_sql) {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL tanımlı değil');
    _sql = neon(process.env.DATABASE_URL);
  }
  return _sql;
}

// Tarihler metin olarak tutulur: gün alanları YYYY-MM-DD, updated_at ISO zaman damgası.
export function ensureSchema() {
  if (!_ready) {
    _ready = (async () => {
      const q = sql();
      await q`CREATE TABLE IF NOT EXISTS records (
        id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
        title text NOT NULL,
        category text NOT NULL DEFAULT 'diger',
        area text NOT NULL DEFAULT '',
        owner text NOT NULL DEFAULT '',
        status text NOT NULL DEFAULT 'acik',
        priority text NOT NULL DEFAULT 'orta',
        env text NOT NULL DEFAULT '',
        source_url text NOT NULL DEFAULT '',
        error_message text NOT NULL DEFAULT '',
        expected_fix text NOT NULL DEFAULT '',
        next_action text NOT NULL DEFAULT '',
        created_at text NOT NULL DEFAULT '',
        updated_at text NOT NULL DEFAULT '',
        due_date text NOT NULL DEFAULT '',
        resolved_at text NOT NULL DEFAULT '',
        source text NOT NULL DEFAULT 'manual',
        external_id text UNIQUE,
        group_key text NOT NULL DEFAULT ''
      )`;
      await q`CREATE TABLE IF NOT EXISTS decisions (
        id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
        title text NOT NULL,
        note text NOT NULL DEFAULT '',
        status text NOT NULL DEFAULT 'bekliyor',
        owner text NOT NULL DEFAULT '',
        decided_at text NOT NULL DEFAULT '',
        created_at text NOT NULL DEFAULT '',
        updated_at text NOT NULL DEFAULT ''
      )`;
      await q`CREATE TABLE IF NOT EXISTS reminders (
        id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
        title text NOT NULL,
        note text NOT NULL DEFAULT '',
        due_date text NOT NULL DEFAULT '',
        done boolean NOT NULL DEFAULT false,
        updated_at text NOT NULL DEFAULT ''
      )`;
      await q`CREATE TABLE IF NOT EXISTS settings (key text PRIMARY KEY, value text NOT NULL DEFAULT '')`;
      await q`CREATE TABLE IF NOT EXISTS checks (
        service text PRIMARY KEY,
        ok boolean NOT NULL DEFAULT true,
        message text NOT NULL DEFAULT '',
        ran_at text NOT NULL DEFAULT ''
      )`;
    })().catch((e) => {
      _ready = null;
      throw e;
    });
  }
  return _ready;
}

// İstemciden yazılabilen sütunlar.
export const TABLES = {
  records: ['title', 'category', 'area', 'owner', 'status', 'priority', 'env', 'source_url', 'error_message', 'expected_fix', 'next_action', 'created_at', 'due_date', 'resolved_at'],
  decisions: ['title', 'note', 'status', 'owner', 'decided_at', 'created_at'],
  reminders: ['title', 'note', 'due_date', 'done'],
};
