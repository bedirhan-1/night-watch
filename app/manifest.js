// Telefonda "Ana ekrana ekle" için ad, renk ve ikonlar.
export default function manifest() {
  return {
    name: 'Night Watch',
    short_name: 'Night Watch',
    description: 'Projelerinin başında nöbet tutar',
    start_url: '/',
    display: 'standalone',
    background_color: '#1f1d2a',
    theme_color: '#1f1d2a',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
