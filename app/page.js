'use client';

import { useEffect, useState } from 'react';
import { ChevronRight, LogOut, Plus } from 'lucide-react';
import { cn } from '@/lib/cn';
import { api } from '@/lib/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Logo } from '@/components/board/shell';

// Giriş sonrası ilk ekran: takip edilen projeler. Bir projeye basınca o projenin panosu açılır.
export default function Projects() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api('GET', '/api/projects')
      .then(setData)
      .catch((e) => setError(e.message || 'Projeler yüklenemedi'));
  }, []);

  async function create(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError('');
    try {
      const j = await api('POST', '/api/projects', { name });
      window.location.href = `/p/${j.id}#ayarlar`;
    } catch (err) {
      setError(err.message || 'Proje oluşturulamadı');
      setBusy(false);
    }
  }

  async function logout() {
    await api('POST', '/api/auth/logout', {}).catch(() => {});
    window.location.href = '/login';
  }

  const projects = data ? data.projects : [];
  return (
    <div className="min-h-dvh">
      <header className="flex h-14 items-center justify-between gap-3 border-b bg-chrome px-4 lg:px-6">
        <div className="flex items-center gap-3">
          <Logo />
          <div className="leading-tight">
            <div className="text-[15px] font-semibold">Night Watch</div>
            <div className="text-xs text-muted-foreground">{data ? data.user.email : 'Projeler'}</div>
          </div>
        </div>
        <Button variant="ghost" onClick={logout}>
          <LogOut /> Çıkış yap
        </Button>
      </header>

      <main className="mx-auto flex max-w-4xl flex-col gap-5 p-4 lg:p-8">
        <h1 className="text-xl font-semibold">Projeler</h1>
        {error ? <div className="rounded-md border border-crit/50 bg-crit/10 px-3.5 py-2.5 text-sm text-crit">{error}</div> : null}
        {!data && !error ? <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">Projeler yükleniyor…</div> : null}
        {data && !projects.length ? (
          <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
            Henüz proje yok. Aşağıdan ilk projeni ekle.
          </div>
        ) : null}

        {projects.length ? (
          <ul className="divide-y overflow-hidden rounded-lg border bg-card">
            {projects.map((p) => (
              <li key={p.id}>
                <a href={`/p/${p.id}`} className="flex items-center gap-3 px-4 py-3.5 outline-none transition-colors hover:bg-muted/40 focus-visible:bg-muted/40">
                  <span className={cn('h-9 w-1 shrink-0 rounded-full', p.critical ? 'bg-crit' : p.late ? 'bg-high' : 'bg-primary')} />
                  <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <span className="truncate text-[15px] font-medium">{p.name}</span>
                    <span className="flex flex-wrap gap-1.5">
                      {p.owner ? null : <Badge variant="primary">üye</Badge>}
                      <Badge>{p.open} açık</Badge>
                      {p.critical ? <Badge variant="crit">{p.critical} kritik</Badge> : null}
                      {p.late ? <Badge variant="solid">{p.late} geciken</Badge> : null}
                      {p.reminders ? <Badge variant="high">{p.reminders} hatırlatma</Badge> : null}
                      {p.failing ? <Badge variant="crit">{p.failing} servis hatası</Badge> : null}
                    </span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </a>
              </li>
            ))}
          </ul>
        ) : null}

        {data ? (
          <form onSubmit={create} className="flex flex-col gap-2">
            <label htmlFor="new-project" className="text-sm font-semibold">
              Yeni proje
            </label>
            <div className="flex flex-wrap gap-2">
              <Input id="new-project" className="min-w-52 flex-1" placeholder="Proje adı, örn. Bikort" value={name} onChange={(e) => setName(e.target.value)} />
              <Button type="submit" disabled={busy}>
                <Plus /> {busy ? 'Ekleniyor…' : 'Proje ekle'}
              </Button>
            </div>
          </form>
        ) : null}
      </main>
    </div>
  );
}
