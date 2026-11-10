'use client';

import { useState } from 'react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await fetch('/api/auth/request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok) setSent(true);
      else setError(j.error || 'Bağlantı gönderilemedi');
    } catch {
      setError('Sunucuya ulaşılamadı');
    }
    setBusy(false);
  }

  return (
    <form className="login" onSubmit={submit}>
      <h1>
        Night <span>Watch</span>
      </h1>
      {sent ? (
        <p>Bu adresin erişimi varsa giriş bağlantısı gönderildi. Bağlantı 15 dakika geçerli; gelen kutunu kontrol et.</p>
      ) : (
        <>
          <label htmlFor="email" className="muted small">
            E-posta adresin
          </label>
          <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
          <button className="btn primary" type="submit" disabled={busy}>
            {busy ? 'Gönderiliyor…' : 'Giriş bağlantısı gönder'}
          </button>
        </>
      )}
      <div className="err" role="alert">
        {error}
      </div>
    </form>
  );
}
