import Link from 'next/link';
import FlashcardReview from '@/components/FlashcardReview';
import FlashcardDeck from '@/components/FlashcardDeck';
import { allCards, deckStats, dueCards } from '@/lib/flashcards';
import { requireUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function FlashcardsPage({
  searchParams,
}: {
  searchParams: Promise<{ ver?: string }>;
}) {
  const sp = await searchParams;
  const showDeck = sp.ver === 'mazo';

  const user = await requireUser();
  const [stats, due] = await Promise.all([deckStats(user.id), dueCards(user.id, 30)]);

  if (stats.total === 0) {
    return (
      <div className="card p-10 text-center space-y-3">
        <h1 className="text-xl font-bold">Aun no hay flashcards</h1>
        <p className="text-sm text-ink-400 max-w-md mx-auto">
          Las tarjetas se crean solas: cada palabra que falles o dejes en blanco en un
          examen entra al mazo automaticamente, con la frase en la que aparecio.
        </p>
        <Link href="/quiz" className="btn btn-primary mt-2">Hacer un examen</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Flashcards</h1>
          <p className="text-ink-400 text-sm mt-1">
            {stats.due > 0
              ? `${stats.due} ${stats.due === 1 ? 'tarjeta lista' : 'tarjetas listas'} para repasar`
              : 'Nada pendiente por ahora'}
            {stats.reviewedToday > 0 && ` · ${stats.reviewedToday} repasadas hoy`}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/flashcards" className={`btn ${showDeck ? 'btn-ghost' : 'btn-primary'}`}>
            Repasar
          </Link>
          <Link href="/flashcards?ver=mazo" className={`btn ${showDeck ? 'btn-primary' : 'btn-ghost'}`}>
            Ver el mazo ({stats.total})
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Tile label="Pendientes" value={stats.due} accent={stats.due > 0} />
        <Tile label="Nuevas" value={stats.fresh} />
        <Tile label="Aprendiendo" value={stats.learning} />
        <Tile label="Consolidadas" value={stats.mature} />
      </div>

      {showDeck ? (
        <FlashcardDeck cards={await allCards(user.id)} />
      ) : due.length === 0 ? (
        <div className="card p-10 text-center space-y-3">
          <div className="text-4xl">✓</div>
          <p className="font-semibold">Mazo al dia</p>
          <p className="text-sm text-ink-400">
            Vuelve mas tarde, o haz un examen para alimentar el mazo con lo que falles.
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <Link href="/quiz" className="btn btn-primary">Hacer un examen</Link>
            <Link href="/flashcards?ver=mazo" className="btn btn-ghost">Ver el mazo</Link>
          </div>
        </div>
      ) : (
        <FlashcardReview initial={due} />
      )}
    </div>
  );
}

function Tile({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="card p-4">
      <div className="text-xs uppercase tracking-wider text-ink-400 font-semibold">{label}</div>
      <div className={`text-2xl font-bold mt-1 tabular-nums ${accent ? 'text-brand-400' : ''}`}>
        {value}
      </div>
    </div>
  );
}
