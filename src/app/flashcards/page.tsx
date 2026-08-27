import Link from 'next/link';
import FlashcardReview from '@/components/FlashcardReview';
import FlashcardDeck from '@/components/FlashcardDeck';
import { allCards, deckStats, dueCards } from '@/lib/flashcards';
import { requireUser } from '@/lib/auth';
import { scriptDecks, vocabTotals } from '@/lib/vocab';

export const dynamic = 'force-dynamic';

export default async function FlashcardsPage({
  searchParams,
}: {
  searchParams: Promise<{ ver?: string }>;
}) {
  const sp = await searchParams;
  const showDeck = sp.ver === 'mazo';

  const user = await requireUser();
  const [stats, due, decks, vocab] = await Promise.all([
    deckStats(user.id), dueCards(user.id, 30), scriptDecks(user.id), vocabTotals(user.id),
  ]);

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

      <section className="space-y-3 pt-4 border-t border-ink-800">
        <div className="flex items-baseline justify-between gap-4 flex-wrap">
          <h2 className="font-semibold">Vocabulario por script</h2>
          <p className="text-xs text-ink-400 tabular-nums">
            {vocab.words} palabras · {vocab.due} pendientes · {vocab.learned} vistas
          </p>
        </div>
        <p className="text-sm text-ink-400">
          Ingles delante, español detras. Aqui reconoces el significado; las de arriba
          te piden producir la palabra dentro de su frase.
        </p>

        {decks.length === 0 ? (
          <p className="text-sm text-ink-400">
            Todavia no hay palabras de glosario en tus scripts.
          </p>
        ) : (
          <ul className="grid sm:grid-cols-2 gap-3">
            {decks.map((d) => (
              <li key={d.scriptId}>
                <Link href={`/flashcards/${d.scriptId}`}
                  className="card p-4 block hover:border-ink-600 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{d.title}</div>
                      <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-ink-400">
                        {d.level && <span className="chip">{d.level}</span>}
                        <span>{d.words} palabras</span>
                        {d.learned > 0 && <span>· {d.learned} vistas</span>}
                      </div>
                    </div>
                    {d.due > 0 && (
                      <span className="rounded-full bg-brand-500 text-ink-950 text-[0.65rem] font-bold px-2 py-0.5 tabular-nums leading-none shrink-0">
                        {d.due}
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
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
