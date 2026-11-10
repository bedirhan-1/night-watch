import { NextResponse } from 'next/server';
import { COOKIE, sessionToken } from './lib/auth';

export async function middleware(req) {
  const { pathname } = req.nextUrl;
  if (pathname === '/login' || pathname === '/api/login' || pathname.startsWith('/api/cron/')) return NextResponse.next();

  const expected = await sessionToken();
  const got = req.cookies.get(COOKIE)?.value || '';
  if (expected && got === expected) return NextResponse.next();

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: expected ? 'Oturum gerekli' : 'APP_PASSWORD tanımlı değil' }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
