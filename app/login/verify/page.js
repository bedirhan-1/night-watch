'use client';

import { useEffect, useState } from 'react';

// Bağlantı açılınca oturum hemen açılmaz, düğmeye basmak gerekir:
// e-posta tarayıcılarının bağlantıyı önceden açıp tek kullanımlık kodu tüketmesini önler.
export default function Verify() {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get('token') || '');
  }, []);

  async function confirm() {
    setBusy(true);
    setError('');
    try {
      const r = await fetch('/api/auth/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
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
    <div className="login">
      <h1>
        Night <span>Watch</span>
      </h1>
      <p>Girişi tamamlamak için düğmeye bas.</p>
      <button className="btn primary" type="button" onClick={confirm} disabled={busy || !token}>
        {busy ? 'Giriş yapılıyor…' : 'Giriş yap'}
      </button>
      <div className="err" role="alert">
        {error}
      </div>
      <a className="back" href="/login">
        Yeni bağlantı iste
      </a>
    </div>
  );
}
