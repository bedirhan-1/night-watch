import './globals.css';

export const metadata = {
  title: 'Night Watch',
  description: 'Projelerinin başında nöbet tutar',
  applicationName: 'Night Watch',
  appleWebApp: { title: 'Night Watch', statusBarStyle: 'black-translucent' },
  openGraph: { title: 'Night Watch', description: 'Projelerinin başında nöbet tutar', siteName: 'Night Watch', type: 'website' },
  robots: { index: false, follow: false },
};

export const viewport = { width: 'device-width', initialScale: 1, themeColor: '#1f1d2a' };

export default function RootLayout({ children }) {
  return (
    <html lang="tr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
