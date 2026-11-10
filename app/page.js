'use client';

import { useEffect } from 'react';

// Pano arayüzü public/board.js içindeki sade JavaScript ile çizilir; React yalnızca iskeleti basar ve betiği yükler.
const SKELETON = `
<div class="wrap">
  <header class="top">
    <div class="brand"><h1>Bikort <span>Operasyon</span></h1><small id="sub">Geliştirme ve operasyon kayıtları</small></div>
    <button class="btn primary" id="addRecord" type="button">+ Kayıt</button>
  </header>
  <nav class="tabs" aria-label="Görünümler">
    <a href="#kanban">Kanban</a><a href="#liste">Liste</a><a href="#zaman">Zaman çizelgesi</a><a href="#hafta">Haftalık özet</a><a href="#kararlar">Kararlar</a><a href="#hatirlatmalar">Hatırlatmalar</a><a href="#ayarlar">Ayarlar</a>
  </nav>
  <div class="notice" id="status" hidden></div>
  <section class="attn" id="attn" hidden aria-label="Kritik ve geciken işler"></section>
  <div class="filters" id="filters">
    <input type="search" id="f-q" placeholder="Başlık, hata mesajı veya aksiyonda ara" aria-label="Ara">
    <select id="f-status" aria-label="Durum"></select>
    <select id="f-owner" aria-label="Sorumlu"></select>
    <select id="f-priority" aria-label="Öncelik"></select>
    <select id="f-area" aria-label="Proje alanı"></select>
  </div>
  <main id="view"><div class="empty">Kayıtlar yükleniyor…</div></main>
</div>
<dialog id="dlg"></dialog>
<datalist id="dl-owner"></datalist><datalist id="dl-area"></datalist>
<div id="toast" role="status" hidden></div>
`;

export default function Page() {
  useEffect(() => {
    if (window.__bikortBoard) return;
    window.__bikortBoard = true;
    const s = document.createElement('script');
    s.src = '/board.js';
    document.body.appendChild(s);
  }, []);
  return <div suppressHydrationWarning dangerouslySetInnerHTML={{ __html: SKELETON }} />;
}
