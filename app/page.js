'use client';

import { useEffect, useState } from 'react';

// Giriş sonrası ilk ekran: takip edilen projeler. Bir projeye basınca o projenin panosu açılır.
export default function Projects() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const r = await fetch('/api/projects', { cache: 'no-store' });
    if (r.status === 401) {
      window.location.href = '/login';
      return;
    }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) setError(j.error || 'Projeler yüklenemedi');
    else setData(j);
  }

  useEffect(() => {
    load().catch(() => setError('Sunucuya ulaşılamadı'));
  }, []);

  async function create(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError('');
    try {
      const r = await fetch('/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok) {
        window.location.href = '/p/' + j.id + '#ayarlar';
        return;
      }
      setError(j.error || 'Proje oluşturulamadı');
    } catch {
      setError('Sunucuya ulaşılamadı');
    }
    setBusy(false);
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    window.location.href = '/login';
  }

  const projects = data ? data.projects : [];
  return (
    <div className="wrap">
      <header className="top">
        <div className="brand">
          <h1>
            Night <span>Watch</span>
          </h1>
          <small>{data ? data.user.email : 'Projeler'}</small>
        </div>
        <button className="btn ghost" type="button" onClick={logout}>
          Çıkış yap
        </button>
      </header>

      {error ? <div className="notice">{error}</div> : null}

      {!data && !error ? <div className="empty">Projeler yükleniyor…</div> : null}

      {data && !projects.length ? (
        <div className="empty">{data.user.admin ? 'Henüz proje yok. Aşağıdan ilk projeni ekle.' : 'Üyesi olduğun bir proje yok.'}</div>
      ) : null}

      <div className="pgrid">
        {projects.map((p) => (
          <a key={p.id} className={'card' + (p.critical ? ' p-kritik' : p.late ? ' p-yuksek' : ' p-orta')} href={'/p/' + p.id}>
            <span className="t">{p.name}</span>
            <span className="meta">
              <span className="chip">{p.open} açık</span>
              {p.critical ? <span className="chip p-kritik">{p.critical} kritik</span> : null}
              {p.late ? <span className="chip late">{p.late} geciken</span> : null}
              {p.reminders ? <span className="chip p-yuksek">{p.reminders} hatırlatma</span> : null}
              {p.failing ? <span className="chip bad">{p.failing} servis hatası</span> : null}
            </span>
          </a>
        ))}
      </div>

      {data && data.user.admin ? (
        <form className="sec" onSubmit={create}>
          <h3>Yeni proje</h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              id="new-project"
              className="field"
              style={{ flex: '1 1 220px' }}
              type="text"
              placeholder="Proje adı, örn. Bikort"
              aria-label="Proje adı"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <button className="btn primary" type="submit" disabled={busy}>
              {busy ? 'Ekleniyor…' : 'Proje ekle'}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
