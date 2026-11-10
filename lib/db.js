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

// Tarihler metin olarak tutulur: gün alanları YYYY-MM-DD, zaman damgaları ISO (UTC).
export function ensureSchema() {
  if (!_ready) {
    _ready = (async () => {
      const q = sql();
      await q`CREATE TABLE IF NOT EXISTS users (
        id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
        email text NOT NULL UNIQUE,
        created_at text NOT NULL DEFAULT ''
      )`;
      await q`CREATE TABLE IF NOT EXISTS login_tokens (
        token_hash text PRIMARY KEY,
        email text NOT NULL,
        created_at text NOT NULL,
        expires_at text NOT NULL,
        used boolean NOT NULL DEFAULT false
      )`;
      await q`CREATE TABLE IF NOT EXISTS sessions (
        token_hash text PRIMARY KEY,
        user_id text NOT NULL,
        expires_at text NOT NULL
      )`;
      await q`CREATE TABLE IF NOT EXISTS projects (
        id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
        name text NOT NULL,
        notify_email text NOT NULL DEFAULT '',
        default_owner text NOT NULL DEFAULT '',
        members text NOT NULL DEFAULT '',
        credentials_enc text NOT NULL DEFAULT '',
        created_at text NOT NULL DEFAULT ''
      )`;
      await q`CREATE TABLE IF NOT EXISTS records (
        id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
        project_id text NOT NULL,
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
        external_id text,
        group_key text NOT NULL DEFAULT '',
        UNIQUE (project_id, external_id)
      )`;
      await q`CREATE INDEX IF NOT EXISTS records_project_idx ON records (project_id)`;
      await q`CREATE TABLE IF NOT EXISTS decisions (
        id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
        project_id text NOT NULL,
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
        project_id text NOT NULL,
        title text NOT NULL,
        note text NOT NULL DEFAULT '',
        due_date text NOT NULL DEFAULT '',
        done boolean NOT NULL DEFAULT false,
        updated_at text NOT NULL DEFAULT ''
      )`;
      await q`CREATE TABLE IF NOT EXISTS checks (
        project_id text NOT NULL,
        service text NOT NULL,
        ok boolean NOT NULL DEFAULT true,
        message text NOT NULL DEFAULT '',
        ran_at text NOT NULL DEFAULT '',
        PRIMARY KEY (project_id, service)
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
