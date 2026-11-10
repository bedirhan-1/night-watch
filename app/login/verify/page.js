'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/board/shell';

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
    <main className="flex min-h-dvh items-center justify-center p-4">
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-xl border bg-card p-6 shadow-xl">
        <div className="flex items-center gap-3">
          <Logo />
          <h1 className="text-xl font-semibold">Night Watch</h1>
        </div>
        <p className="text-sm text-muted-foreground">Girişi tamamlamak için düğmeye bas.</p>
        <Button onClick={confirm} disabled={busy || !token}>
          {busy ? 'Giriş yapılıyor…' : 'Giriş yap'}
        </Button>
        {error ? (
          <p role="alert" className="text-sm text-crit">
            {error}
          </p>
        ) : null}
        <a href="/login" className="text-[13px] text-link hover:underline">
          Yeni bağlantı iste
        </a>
      </div>
    </main>
  );
}
