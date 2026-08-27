import Link from 'next/link';
import { notFound } from 'next/navigation';
import VocabReview from '@/components/VocabReview';
import { requireUser } from '@/lib/auth';
import { deckCards, scriptTitle } from '@/lib/vocab';

export const dynamic = 'force-dynamic';

export default async function DeckPage({ params }: { params: Promise<{ scriptId: string }> }) {
  const { scriptId } = await params;
  const user = await requireUser();
  const id = Number(scriptId);

  const title = await scriptTitle(id, user.id);
  if (!title) notFound();

  const cards = await deckCards(user.id, id);
  if (!cards.length) notFound();

  const pendientes = cards.filter((c) => c.due && !c.suspended).length;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/flashcards" className="text-xs text-ink-400 hover:text-ink-100">
          &larr; Mazos
        </Link>
        <h1 className="text-2xl font-bold tracking-tight mt-1">{title}</h1>
        <p className="text-ink-400 text-sm mt-1">
          {cards.length} palabras · {pendientes} pendientes
        </p>
      </div>
      <VocabReview cards={cards} title={title} scriptId={id} />
    </div>
  );
}
