'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { ChevronLeft, Play, Plus, RotateCcw } from 'lucide-react';
import { api } from '@/lib/client';
import { applyFilters, isDone, matchPreset, today, uniq, CAT, PRESETS } from '@/lib/board';
import { Button } from '@/components/ui/button';
import { Rail, Sidebar, MobileStrip, BottomNav, VIEW_TITLES, isIssueView } from '@/components/board/shell';
import { FilterBar, Attention, IssueTable, KanbanView, TimelineView } from '@/components/board/issues';
import { WeekPanel, DecisionsPanel, RemindersPanel, SettingsPanel } from '@/components/board/panels';
import { EditDialog } from '@/components/board/dialogs';
import { Empty, PeopleContext } from '@/components/board/bits';

const VIEWS = Object.keys(VIEW_TITLES);
const EMPTY_FILTERS = { q: '', status: '', owner: '', priority: '', area: '' };
const readView = () => {
  const h = typeof window === 'undefined' ? '' : window.location.hash.slice(1);
  return VIEWS.includes(h) ? h : 'akis';
};

export default function Board() {
  const { id } = useParams();
  const base = `/api/projects/${encodeURIComponent(id)}`;
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [view, setView] = useState('akis');
  const [preset, setPreset] = useState('open');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [sort, setSort] = useState('oneri');
  const [dialog, setDialog] = useState(null);
  const [busy, setBusy] = useState(false);
  const [toastText, setToastText] = useState('');
  const toastTimer = useRef(null);
  const viewRef = useRef('akis');
  const dialogRef = useRef(null);
  viewRef.current = view;
  dialogRef.current = dialog;

  const toast = useCallback((m) => {
    setToastText(m);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastText(''), 3800);
  }, []);

  const load = useCallback(async () => {
    try {
      const s = await api('GET', `${base}/state`);
      setData(s);
      setError('');
      if (s.meta && s.meta.project) document.title = `${s.meta.project.name} · Night Watch`;
    } catch (e) {
      setError(e.message || 'Kayıtlara ulaşılamadı');
    }
  }, [base]);

  useEffect(() => {
    setView(readView());
    const onHash = () => setView(readView());
    // Sekmeye dönünce veriyi tazele; yarım kalmış bir formu ezmemek için ayarlarda ya da açık pencerede bekle.
    const onVisible = () => {
      if (!document.hidden && viewRef.current !== 'ayarlar' && !dialogRef.current) load();
    };
    window.addEventListener('hashchange', onHash);
    document.addEventListener('visibilitychange', onVisible);
    load();
    return () => {
      window.removeEventListener('hashchange', onHash);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  // Her yazma işleminden sonra durumu sunucudan yeniden okur.
  const run = useCallback(
    async (fn, okMessage) => {
      try {
        const r = await fn();
        await load();
        if (okMessage) toast(typeof okMessage === 'function' ? okMessage(r) : okMessage);
        return true;
      } catch (e) {
        toast(e.message || 'Kaydedilemedi, tekrar dene.');
        return false;
      }
    },
    [load, toast],
  );

  const records = data ? data.records : [];
  const decisions = data ? data.decisions : [];
  const reminders = data ? data.reminders : [];
  const meta = data ? data.meta : { services: [] };
  const projectName = meta.project ? meta.project.name : '';

  const counts = useMemo(() => {
    const c = {};
    PRESETS.forEach(([k]) => (c[k] = records.filter((r) => matchPreset(r, k)).length));
    CAT.forEach(([k]) => (c['cat:' + k] = records.filter((r) => matchPreset(r, 'cat:' + k)).length));
    return c;
  }, [records]);
  const list = useMemo(() => applyFilters(records, preset, filters), [records, preset, filters]);
  // Kanban'da "Çözülmemiş" görünümü Çözüldü sütununu boşaltmasın diye tüm kayıtlar gösterilir.
  const kanbanList = useMemo(() => applyFilters(records, preset === 'open' ? 'all' : preset, filters), [records, preset, filters]);
  const areas = useMemo(() => uniq(records, 'area'), [records]);
  const t = today();
  const dueReminders = reminders.filter((m) => !m.done && m.dueDate && m.dueDate <= t).length;
  const open = records.filter((r) => !isDone(r)).length;

  const openRecord = (r) => setDialog({ table: 'records', item: r });
  const patchRecord = (r, patch) => {
    const body = { ...patch };
    if (patch.status) body.resolvedAt = patch.status === 'cozuldu' ? r.resolvedAt || today() : '';
    return run(() => api('PUT', `${base}/data/records/${r.id}`, body));
  };
  const quickAdd = (status, title) =>
    run(() =>
      api('POST', `${base}/data/records`, {
        title,
        status,
        category: preset.startsWith('cat:') ? preset.slice(4) : 'gorev',
        priority: 'orta',
        owner: meta.me ? meta.me.email : '',
        createdAt: today(),
        resolvedAt: status === 'cozuldu' ? today() : '',
      }),
    );
  const save = async (table, body, rowId) => {
    setDialog(null);
    await run(() => api(rowId ? 'PUT' : 'POST', `${base}/data/${table}${rowId ? '/' + rowId : ''}`, body));
  };
  const remove = async (table, rowId) => {
    setDialog(null);
    await run(() => api('DELETE', `${base}/data/${table}/${rowId}`));
  };
  const check = async (mail) => {
    setBusy(true);
    toast(mail ? 'Özet gönderiliyor…' : 'Servisler kontrol ediliyor…');
    await run(
      () => api('POST', `${base}/run`, mail ? { mail: true } : {}),
      (j) => (mail ? `Özet ${j.mailedTo} adresine gönderildi.` : `Kontrol bitti: ${j.created} yeni kayıt.`),
    );
    setBusy(false);
  };
  const logout = async () => {
    await api('POST', '/api/auth/logout', {}).catch(() => {});
    window.location.href = '/login';
  };

  const issueView = isIssueView(view);
  let body;
  if (!data) {
    body = <Empty>{error ? `Kayıtlara ulaşılamadı: ${error}` : 'Kayıtlar yükleniyor…'}</Empty>;
  } else if (view === 'hafta') {
    body = <WeekPanel projectName={projectName} records={records} decisions={decisions} onOpenRecord={openRecord} onOpenDecision={(d) => setDialog({ table: 'decisions', item: d })} toast={toast} />;
  } else if (view === 'kararlar') {
    body = <DecisionsPanel decisions={decisions} onOpen={(d) => setDialog({ table: 'decisions', item: d })} onNew={() => setDialog({ table: 'decisions', item: null })} />;
  } else if (view === 'hatirlatmalar') {
    body = (
      <RemindersPanel
        reminders={reminders}
        onOpen={(m) => setDialog({ table: 'reminders', item: m })}
        onNew={() => setDialog({ table: 'reminders', item: null })}
        onToggle={(m) => run(() => api('PUT', `${base}/data/reminders/${m.id}`, { done: !m.done }))}
      />
    );
  } else if (view === 'ayarlar') {
    body = (
      <SettingsPanel
        meta={meta}
        busy={busy}
        onSaveProfile={(f) => run(() => api('PUT', '/api/me', f), 'Profil kaydedildi.')}
        onSaveProject={(f) =>
          run(
            () => api('PUT', base, f),
            (j) =>
              j.failed && j.failed.length
                ? `Kaydedildi, ancak şu adreslere davet gönderilemedi: ${j.failed.join(', ')}`
                : j.invited
                  ? `Kaydedildi. ${j.invited} kişiye davet maili gönderildi.`
                  : 'Proje ayarları kaydedildi.',
          )
        }
        onSaveCreds={(values) => run(() => api('PUT', `${base}/credentials`, { values }), 'Bağlantı kaydedildi.')}
        onClearCreds={(key) => run(() => api('PUT', `${base}/credentials`, { clear: key }), 'Bağlantı kaldırıldı.')}
        onRun={() => check(false)}
        onMail={() => check(true)}
        onLogout={logout}
        onDeleteProject={async () => {
          try {
            await api('DELETE', base);
            window.location.href = '/';
          } catch (e) {
            toast(e.message);
          }
        }}
      />
    );
  } else if (view === 'kanban') {
    body = <KanbanView list={kanbanList} sort={sort} onOpen={openRecord} onPatch={patchRecord} onQuickAdd={quickAdd} />;
  } else if (!records.length) {
    body = <Empty>Henüz kayıt yok. “Kayıt” düğmesiyle ilkini ekle ya da Ayarlar’dan bir servis bağlayıp “Şimdi kontrol et”e bas.</Empty>;
  } else if (view === 'zaman') {
    body = <TimelineView list={list} onOpen={openRecord} />;
  } else {
    body = <IssueTable list={list} sort={sort} onOpen={openRecord} onPatch={patchRecord} />;
  }

  const peopleValue = useMemo(() => ({ people: meta.people || [], me: meta.me || null }), [meta.people, meta.me]);

  return (
    <PeopleContext.Provider value={peopleValue}>
    <div className="flex h-dvh overflow-hidden">
      <Rail view={view} dueReminders={dueReminders} me={meta.me || null} onLogout={logout} />
      {issueView ? <Sidebar projectName={projectName} view={view} preset={preset} setPreset={setPreset} counts={counts} /> : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b bg-chrome px-4">
          <div className="flex min-w-0 items-center gap-2">
            <a href="/" aria-label="Projeler" className="-ml-1 rounded-md p-1.5 text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring lg:hidden">
              <ChevronLeft className="size-5" />
            </a>
            <div className="min-w-0">
              <h1 className="truncate text-[15px] font-semibold leading-tight">
                <span className={issueView ? 'lg:hidden' : ''}>{projectName || 'Night Watch'}</span>
                <span className={issueView ? 'hidden lg:inline' : 'hidden'}>{VIEW_TITLES[view]}</span>
              </h1>
              <p className="truncate text-xs text-muted-foreground">
                <span className={issueView ? 'lg:hidden' : ''}>{VIEW_TITLES[view]} · </span>
                {data ? `${open} açık kayıt` : 'Yükleniyor'}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" size="icon" aria-label="Servisleri şimdi kontrol et" title="Servisleri şimdi kontrol et" disabled={busy || !data} onClick={() => check(false)}>
              {busy ? <RotateCcw className="animate-spin" /> : <Play />}
            </Button>
            <Button disabled={!data} onClick={() => setDialog({ table: 'records', item: null })}>
              <Plus /> Kayıt
            </Button>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="flex flex-col gap-4 p-4 pb-24 lg:p-6 lg:pb-8">
            {data && error ? <div className="rounded-md border border-high/50 bg-high/10 px-3.5 py-2.5 text-sm text-high">Veri güncellenemedi: {error}</div> : null}
            {data && issueView ? <MobileStrip view={view} preset={preset} setPreset={setPreset} counts={counts} /> : null}
            {data && view !== 'ayarlar' && view !== 'kararlar' && view !== 'hatirlatmalar' ? <Attention records={records} onOpen={openRecord} /> : null}
            {data && issueView && records.length ? <FilterBar records={records} f={filters} setF={setFilters} preset={preset} setPreset={setPreset} sort={sort} setSort={setSort} /> : null}
            {body}
          </div>
        </main>
      </div>

      <BottomNav view={view} dueReminders={dueReminders} />
      <EditDialog dialog={dialog} areas={areas} onSave={save} onDelete={remove} onClose={() => setDialog(null)} />
      {toastText ? (
        <div role="status" className="fixed bottom-20 left-1/2 z-[70] max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-md border border-primary bg-popover px-4 py-2.5 text-sm shadow-xl lg:bottom-6">
          {toastText}
        </div>
      ) : null}
    </div>
    </PeopleContext.Provider>
  );
}
