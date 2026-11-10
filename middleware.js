import { NextResponse } from 'next/server';

// Burada yalnızca oturum çerezinin varlığına bakılır; çerezin geçerliliği ve proje yetkisi her API çağrısında veritabanından doğrulanır.
const COOKIE = 'nw_session';

export function middleware(req) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith('/login') || pathname.startsWith('/api/auth/') || pathname.startsWith('/api/cron/')) return NextResponse.next();
  if (req.cookies.get(COOKIE)?.value) return NextResponse.next();
  if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'Oturum gerekli' }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
