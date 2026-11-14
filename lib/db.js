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
      await q`ALTER TABLE users ADD COLUMN IF NOT EXISTS name text NOT NULL DEFAULT ''`;
      await q`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar text NOT NULL DEFAULT ''`;
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
      // Sahiplik sonradan eklendi: sahibi olmayan eski projeler ilk yöneticiye (ADMIN_EMAILS) ya da bildirim adresine devredilir.
      await q`ALTER TABLE projects ADD COLUMN IF NOT EXISTS owner_email text NOT NULL DEFAULT ''`;
      const legacy = String(process.env.ADMIN_EMAILS || '').toLowerCase().split(',')[0].trim();
      await q`UPDATE projects SET owner_email = CASE WHEN ${legacy} <> '' THEN ${legacy} ELSE lower(notify_email) END WHERE owner_email = ''`;
      await q`ALTER TABLE projects ADD COLUMN IF NOT EXISTS ingest_key text NOT NULL DEFAULT ''`;
      await q`ALTER TABLE projects ADD COLUMN IF NOT EXISTS alert_mode text NOT NULL DEFAULT 'hepsi'`;
      await q`ALTER TABLE projects ADD COLUMN IF NOT EXISTS alert_day text NOT NULL DEFAULT ''`;
      await q`ALTER TABLE projects ADD COLUMN IF NOT EXISTS alert_count integer NOT NULL DEFAULT 0`;
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
      await q`ALTER TABLE records ADD COLUMN IF NOT EXISTS occurrences integer NOT NULL DEFAULT 1`;
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
      // Elle tutulan günlük: "1.0.2 sürümünü yayınladım" gibi kısa kayıtlar.
      await q`CREATE TABLE IF NOT EXISTS logs (
        id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
        project_id text NOT NULL,
        title text NOT NULL,
        note text NOT NULL DEFAULT '',
        kind text NOT NULL DEFAULT 'olay',
        author text NOT NULL DEFAULT '',
        logged_at text NOT NULL DEFAULT '',
        updated_at text NOT NULL DEFAULT ''
      )`;
      await q`CREATE INDEX IF NOT EXISTS logs_project_idx ON logs (project_id)`;
      await q`CREATE TABLE IF NOT EXISTS checks (
        project_id text NOT NULL,
        service text NOT NULL,
        ok boolean NOT NULL DEFAULT true,
        message text NOT NULL DEFAULT '',
        ran_at text NOT NULL DEFAULT '',
        PRIMARY KEY (project_id, service)
      )`;
      // Claude ile otomatik düzeltme: üyenin proje başına bulut görevi bağlantısı ve her tetiklemenin kaydı.
      await q`CREATE TABLE IF NOT EXISTS claude_links (
        project_id text NOT NULL,
        user_email text NOT NULL,
        fire_url text NOT NULL,
        token_enc text NOT NULL,
        broken text NOT NULL DEFAULT '',
        created_at text NOT NULL DEFAULT '',
        updated_at text NOT NULL DEFAULT '',
        PRIMARY KEY (project_id, user_email)
      )`;
      // status: calisiyor, pr, cozulemedi, tetiklenemedi, tamam (başarılı deneme). trigger: otomatik, elle, deneme.
      await q`CREATE TABLE IF NOT EXISTS fix_runs (
        id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
        project_id text NOT NULL,
        record_id text NOT NULL DEFAULT '',
        user_email text NOT NULL,
        trigger text NOT NULL,
        status text NOT NULL DEFAULT 'calisiyor',
        session_url text NOT NULL DEFAULT '',
        pr_url text NOT NULL DEFAULT '',
        summary text NOT NULL DEFAULT '',
        error text NOT NULL DEFAULT '',
        callback_hash text NOT NULL DEFAULT '',
        created_at text NOT NULL DEFAULT '',
        updated_at text NOT NULL DEFAULT ''
      )`;
      await q`CREATE INDEX IF NOT EXISTS fix_runs_record_idx ON fix_runs (project_id, record_id)`;
      // Bir kayıt için aynı anda yalnızca bir çalışma sürebilir; eşzamanlı istekleri veritabanı durdurur.
      await q`CREATE UNIQUE INDEX IF NOT EXISTS fix_runs_active_idx ON fix_runs (project_id, record_id) WHERE status = 'calisiyor' AND record_id <> ''`;
      await q`ALTER TABLE projects ADD COLUMN IF NOT EXISTS fix_mode text NOT NULL DEFAULT 'otomatik'`;
      await q`ALTER TABLE projects ADD COLUMN IF NOT EXISTS fix_day text NOT NULL DEFAULT ''`;
      await q`ALTER TABLE projects ADD COLUMN IF NOT EXISTS fix_count integer NOT NULL DEFAULT 0`;
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
  logs: ['title', 'note', 'kind', 'logged_at'],
};
