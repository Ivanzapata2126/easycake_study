import type { Metadata } from 'next';
import Link from 'next/link';
import { getUser } from '@/lib/auth';
import { deckStats } from '@/lib/flashcards';
import { logoutAction } from '@/app/actions';
import './globals.css';

export const metadata: Metadata = {
  title: 'EasyCake',
  description: 'Scripts, dialogos y examenes de ingles',
};

const NAV = [
  { href: '/', label: 'Inicio' },
  { href: '/scripts', label: 'Scripts' },
  { href: '/quiz', label: 'Examen' },
];

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();

  // Sin sesion (login) la pagina va sin la barra: no hay nada que navegar.
  if (!user) {
    return (
      <html lang="es">
        <body>
          <main className="mx-auto max-w-5xl px-5 py-8">{children}</main>
        </body>
      </html>
    );
  }

  let due = 0;
  try {
    due = (await deckStats(user.id)).due;
  } catch {
    // El badge no debe tumbar la pagina si la base parpadea.
  }

  return (
    <html lang="es">
      <body>
        <header className="border-b border-ink-800/80 backdrop-blur sticky top-0 z-20 bg-ink-950/70">
          <div className="mx-auto max-w-5xl px-5 h-14 flex items-center gap-5">
            <Link href="/" className="font-bold tracking-tight text-ink-100 shrink-0">
              Easy<span className="text-brand-400">Cake</span>
            </Link>

            <nav className="flex items-center gap-1 text-sm">
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="px-3 py-1.5 rounded-lg text-ink-400 hover:text-ink-100 hover:bg-ink-850 transition-colors"
                >
                  {n.label}
                </Link>
              ))}
              <Link
                href="/flashcards"
                className="px-3 py-1.5 rounded-lg text-ink-400 hover:text-ink-100 hover:bg-ink-850 transition-colors flex items-center gap-1.5"
              >
                Flashcards
                {due > 0 && (
                  <span className="rounded-full bg-brand-500 text-ink-950 text-[0.65rem] font-bold px-1.5 py-0.5 tabular-nums leading-none">
                    {due}
                  </span>
                )}
              </Link>
              {user.role === 'admin' && (
                <Link
                  href="/admin"
                  className="px-3 py-1.5 rounded-lg text-ink-400 hover:text-ink-100 hover:bg-ink-850 transition-colors"
                >
                  Admin
                </Link>
              )}
            </nav>

            <div className="ml-auto flex items-center gap-3">
              <span className="text-xs text-ink-400 hidden sm:inline">
                {user.name || user.username}
              </span>
              <form action={logoutAction}>
                <button type="submit" className="btn btn-ghost text-xs px-2.5 py-1.5">
                  Salir
                </button>
              </form>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-5 py-8">{children}</main>
      </body>
    </html>
  );
}
