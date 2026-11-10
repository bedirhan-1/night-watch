'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Logo } from '@/components/board/shell';

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
    <main className="flex min-h-dvh items-center justify-center p-4">
      <form onSubmit={submit} className="flex w-full max-w-sm flex-col gap-4 rounded-xl border bg-card p-6 shadow-xl">
        <div className="flex items-center gap-3">
          <Logo />
          <h1 className="text-xl font-semibold">Night Watch</h1>
        </div>
        {sent ? (
          <p className="text-sm text-muted-foreground">Giriş bağlantısı gönderildi. Bağlantı 15 dakika geçerli; gelen kutunu kontrol et. İlk girişinde hesabın kendiliğinden açılır.</p>
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-xs font-medium text-muted-foreground">
                E-posta adresin
              </label>
              <Input id="email" type="email" autoComplete="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <Button type="submit" disabled={busy}>
              {busy ? 'Gönderiliyor…' : 'Giriş bağlantısı gönder'}
            </Button>
          </>
        )}
        {error ? (
          <p role="alert" className="text-sm text-crit">
            {error}
          </p>
        ) : null}
      </form>
    </main>
  );
}
