import Link from 'next/link';
import QuizSetup from '@/components/QuizSetup';
import { listScripts } from '@/lib/scripts';
import { requireUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function QuizPage({
  searchParams,
}: {
  searchParams: Promise<{ script?: string; speaker?: string }>;
}) {
  const sp = await searchParams;
  const user = await requireUser();
  const all = await listScripts(user);
  const usable = all.filter((s) => s.candidate_count > 0);

  if (!usable.length) {
    return (
      <div className="card p-10 text-center space-y-3">
        <p className="text-ink-300">No hay ningun script con huecos analizados.</p>
        <p className="text-sm text-ink-400">
          Agrega un dialogo y la app genera los candidatos automaticamente.
        </p>
        <Link href="/scripts/new" className="btn btn-primary">Agregar script</Link>
      </div>
    );
  }

  const initialScriptId = sp.script ? Number(sp.script) : undefined;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Modo examen</h1>
        <p className="text-ink-400 text-sm mt-1">
          Los huecos cambian en cada intento: se muestrean del banco de candidatos.
        </p>
      </div>
      <QuizSetup
        scripts={usable.map((s) => ({
          id: s.id,
          title: s.title,
          candidate_count: s.candidate_count,
          speakers: s.speakers,
        }))}
        initialScriptId={usable.some((s) => s.id === initialScriptId) ? initialScriptId : undefined}
        initialSpeaker={sp.speaker}
      />
    </div>
  );
}
