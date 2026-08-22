import { notFound } from 'next/navigation';
import { updateScriptAction } from '@/app/actions';
import ScriptForm from '@/components/ScriptForm';
import { canEdit, getScript, getLines } from '@/lib/scripts';
import { requireUser } from '@/lib/auth';
import { toRawText } from '@/lib/parse';

export const dynamic = 'force-dynamic';

export default async function EditScriptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const scriptId = Number(id);
  const script = await getScript(scriptId, user);
  if (!script || !canEdit(script, user)) notFound();

  const lines = await getLines(scriptId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Editar script</h1>
        <p className="text-ink-400 text-sm mt-1">
          Las lineas que no cambies conservan sus huecos y tu historial de aciertos.
        </p>
      </div>
      <ScriptForm
        action={updateScriptAction}
        submitLabel="Guardar cambios"
        isAdmin={user.role === 'admin'}
        initial={{
          id: script.id,
          title: script.title,
          topic: script.topic ?? '',
          level: script.level ?? '',
          source: script.source ?? '',
          notes: script.notes ?? '',
          isPublic: script.is_public,
          raw: toRawText(lines.map((l) => ({ speaker: l.speaker, text: l.text }))),
        }}
      />
    </div>
  );
}
