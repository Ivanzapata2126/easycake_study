import Link from 'next/link';
import { notFound } from 'next/navigation';
import { deleteScriptAction, reanalyzeAction, togglePublicAction } from '@/app/actions';
import ScriptReader from '@/components/ScriptReader';
import { canEdit, getCandidates, getLines, getScript } from '@/lib/scripts';
import { requireUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function ScriptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const scriptId = Number(id);
  const script = await getScript(scriptId, user);
  if (!script) notFound();

  const editable = canEdit(script, user);

  const [lines, candidates] = await Promise.all([
    getLines(scriptId),
    getCandidates(scriptId),
  ]);

  const speakers = [...new Set(lines.map((l) => l.speaker).filter(Boolean))] as string[];
  const enabled = candidates.filter((c) => c.enabled).length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <Link href="/scripts" className="text-xs text-ink-400 hover:text-ink-100">
            &larr; Scripts
          </Link>
          <h1 className="text-2xl font-bold tracking-tight mt-1">{script.title}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
            {script.level && <span className="chip">{script.level}</span>}
            {script.topic && <span className="chip">{script.topic}</span>}
            {script.source && <span className="chip">{script.source}</span>}
            {script.is_public && <span className="chip text-ok-400 border-ok-400/30">publico</span>}
            {!editable && script.owner_username && (
              <span className="chip">de {script.owner_username}</span>
            )}
            <span className="text-ink-400">
              {lines.length} lineas · {enabled} huecos activos
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link href={`/quiz?script=${scriptId}`} className="btn btn-primary">
            Examen de este script
          </Link>
          {editable && (
            <>
              <Link href={`/scripts/${scriptId}/edit`} className="btn btn-ghost">Editar</Link>
              <form action={reanalyzeAction}>
                <input type="hidden" name="id" value={scriptId} />
                <button type="submit" className="btn btn-ghost">Re-analizar</button>
              </form>
            </>
          )}
          {user.role === 'admin' && (
            <form action={togglePublicAction}>
              <input type="hidden" name="id" value={scriptId} />
              <input type="hidden" name="is_public" value={String(!script.is_public)} />
              <button type="submit" className="btn btn-ghost">
                {script.is_public ? 'Despublicar' : 'Publicar'}
              </button>
            </form>
          )}
        </div>
      </div>

      {speakers.length > 1 && (
        <div className="card p-4 flex flex-wrap items-center gap-3">
          <span className="text-sm text-ink-300">Practicar un solo rol:</span>
          {speakers.map((sp) => (
            <Link key={sp} href={`/quiz?script=${scriptId}&speaker=${encodeURIComponent(sp)}`} className="btn btn-ghost">
              Yo soy {sp}
            </Link>
          ))}
        </div>
      )}

      {script.notes && (
        <div className="card p-4 text-sm text-ink-300">{script.notes}</div>
      )}

      {candidates.length === 0 ? (
        <div className="card p-8 text-center text-ink-400 text-sm">
          El analizador no encontro huecos. Prueba con &quot;Re-analizar&quot;, o revisa que el
          texto tenga lineas de al menos 4 palabras.
        </div>
      ) : (
        <ScriptReader scriptId={scriptId} lines={lines} candidates={candidates} editable={editable} />
      )}

      {editable && (
        <form action={deleteScriptAction} className="pt-4 border-t border-ink-800">
          <input type="hidden" name="id" value={scriptId} />
          <button type="submit" className="btn btn-danger">Borrar script</button>
        </form>
      )}
    </div>
  );
}
