'use client';

import { useState } from 'react';

export default function Login() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
      if (r.ok) {
        window.location.href = '/';
        return;
      }
      const j = await r.json().catch(() => ({}));
      setError(j.error || 'Giriş yapılamadı');
    } catch {
      setError('Sunucuya ulaşılamadı');
    }
    setBusy(false);
  }

  return (
    <form className="login" onSubmit={submit}>
      <h1>
        Bikort <span>Operasyon</span>
      </h1>
      <label htmlFor="password" className="muted small">
        Şifre
      </label>
      <input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
      <button className="btn primary" type="submit" disabled={busy}>
        {busy ? 'Giriş yapılıyor…' : 'Giriş yap'}
      </button>
      <div className="err" role="alert">
        {error}
      </div>
    </form>
  );
}
