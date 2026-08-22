// Programacion de repasos (SM-2 simplificado). Modulo puro a proposito: lo usa
// el servidor para persistir y el cliente para mostrar en cada boton cuando
// volveria la tarjeta. Una sola implementacion, sin duplicar la formula.

export type Grade = 0 | 1 | 2;

export const GRADES: Array<{ value: Grade; label: string; tone: string }> = [
  { value: 0, label: 'Otra vez', tone: 'bad' },
  { value: 1, label: 'Dificil', tone: 'warn' },
  { value: 2, label: 'Bien', tone: 'ok' },
];

export interface SrsState {
  ease: number;
  interval: number;
  reps: number;
}

export interface SrsNext extends SrsState {
  lapse: boolean;
}

/**
 *   otra vez -> vuelve en la misma sesion, la facilidad baja fuerte
 *   dificil  -> avanza poco y la facilidad baja un poco
 *   bien     -> 1 dia, luego 3, luego intervalo * ease
 */
export function schedule(grade: Grade, { ease, interval, reps }: SrsState): SrsNext {
  if (grade === 0) {
    return { ease: Math.max(1.3, ease - 0.2), interval: 0, reps: 0, lapse: true };
  }
  if (grade === 1) {
    const next = reps === 0 ? 0.5 : Math.max(1, interval * 1.2);
    return { ease: Math.max(1.3, ease - 0.15), interval: next, reps: reps + 1, lapse: false };
  }
  const next = reps === 0 ? 1 : reps === 1 ? 3 : Math.round(interval * ease * 10) / 10;
  return { ease: Math.min(2.8, ease + 0.05), interval: next, reps: reps + 1, lapse: false };
}

/** "ahora", "12 h", "3 d", "2 mes" — para la etiqueta de cada boton. */
export function formatInterval(days: number): string {
  if (days <= 0) return 'ahora';
  if (days < 1) return `${Math.round(days * 24)} h`;
  if (days < 30) return `${Math.round(days)} d`;
  if (days < 365) return `${Math.round(days / 30)} mes`;
  return `${(days / 365).toFixed(1)} a`;
}
