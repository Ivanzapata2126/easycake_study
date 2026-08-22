import { createScriptAction } from '@/app/actions';
import ScriptForm from '@/components/ScriptForm';
import { requireUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function NewScriptPage() {
  const user = await requireUser();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Nuevo script</h1>
        <p className="text-ink-400 text-sm mt-1">
          Al guardar se analiza el texto y se generan los candidatos a hueco.
        </p>
      </div>
      <ScriptForm action={createScriptAction} submitLabel="Guardar y analizar"
        isAdmin={user.role === 'admin'} />
    </div>
  );
}
