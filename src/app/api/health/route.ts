import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * Sonda para el orquestador. Comprueba que la app responde Y que la base
 * contesta: sin lo segundo un contenedor "vivo" pero sin Postgres pasaria el
 * chequeo y seguiria recibiendo trafico.
 */
export async function GET() {
  try {
    const [row] = await query<{ n: string }>('SELECT COUNT(*) AS n FROM users');
    return NextResponse.json({ ok: true, db: 'up', users: Number(row.n) });
  } catch (err) {
    return NextResponse.json(
      { ok: false, db: 'down', error: err instanceof Error ? err.message : 'error' },
      { status: 503 },
    );
  }
}
