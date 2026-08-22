import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE } from '@/lib/session';

// Filtro barato: si no hay ni cookie, ni siquiera se toca la base.
// La validacion real (que la sesion exista, no haya vencido y el usuario siga
// activo) vive en requireUser(), porque el middleware corre en el edge runtime
// y no puede consultar Postgres.
export function middleware(req: NextRequest) {
  const hasCookie = req.cookies.has(SESSION_COOKIE);
  const { pathname, search } = req.nextUrl;

  if (!hasCookie && pathname !== '/login') {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = pathname === '/' ? '' : `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  if (hasCookie && pathname === '/login') {
    const url = req.nextUrl.clone();
    url.pathname = '/';
    url.search = '';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // /api/health queda fuera: es la sonda del orquestador y debe responder sin
  // sesion. Si el middleware la redirigiera al login, el 307 se leeria como
  // "la app esta caida".
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/health).*)'],
};
