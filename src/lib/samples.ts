import 'server-only';
import { query } from './db';
import { createScript, type ScriptInput } from './scripts';

/**
 * Dialogos de ejemplo para poder probar el modo examen sin escribir nada.
 * Estan elegidos para que el analizador tenga de todo con que trabajar:
 * phrasal verbs, conectores, preposiciones dependientes y formas irregulares.
 */
export const SAMPLES: ScriptInput[] = [
  {
    title: 'Making arrangements - cambio de planes',
    topic: 'Telefono / planes',
    level: 'B1',
    source: 'Ejemplo incluido',
    notes: null,
    raw: `Man: Hey Sarah, I'm calling about Friday. Something has come up at work.
Woman: Oh no. Are you saying you can't make it?
Man: Not exactly. I might have to stay late, so I'd rather push it back an hour.
Woman: That's fine, honestly. Although I've already booked the table for seven.
Man: Could you ring them up and see if they can move it to eight?
Woman: I'll try, but they're usually packed on Fridays. Otherwise we could just meet somewhere else.
Man: Let's do that. I'll look into a couple of places near the office and text you.
Woman: Sounds good. By the way, is Tom still coming along?
Man: He said he would let me know today, but he hasn't got back to me yet.
Woman: Typical. Anyway, don't worry about it, we'll sort it out.`,
  },
  {
    title: 'Job interview - hablando de experiencia',
    topic: 'Trabajo',
    level: 'B2',
    source: 'Ejemplo incluido',
    notes: null,
    raw: `Interviewer: Thanks for coming in. Could you walk me through your background?
Candidate: Of course. I studied engineering, and afterwards I spent three years working on logistics software.
Interviewer: What made you decide to move on?
Candidate: The company was acquired, and the team I had built was gradually broken up.
Interviewer: I see. And what are you looking for now?
Candidate: Somewhere I can take on more responsibility without losing touch with the technical side.
Interviewer: That's fair. How do you deal with tight deadlines?
Candidate: I try to figure out early which parts are genuinely blocking, and I push back when the scope keeps growing.
Interviewer: Interesting. Nevertheless, some projects simply cannot be negotiated.
Candidate: Absolutely. In those cases I would rather cut features than ship something unreliable.`,
  },
  {
    title: 'At the doctor - sintomas',
    topic: 'Salud',
    level: 'A2',
    source: 'Ejemplo incluido',
    notes: null,
    raw: `Doctor: Good morning. What seems to be the problem?
Patient: I've had a terrible headache for about a week and I can't get rid of it.
Doctor: Have you been sleeping properly?
Patient: Not really. I usually wake up around three and then I lie there for hours.
Doctor: Are you under a lot of pressure at the moment?
Patient: A fair amount, yes. We're short-staffed, so I've been working late almost every night.
Doctor: That would certainly explain it. Have you taken anything for the pain?
Patient: Only paracetamol, but it wears off after a couple of hours.
Doctor: I would like to run a few tests before we rule anything out.
Patient: Should I be worried about it?
Doctor: I doubt it, but it's better to check. In the meantime, try to cut down on coffee.`,
  },
];

/** Idempotente: no duplica los que ya estan cargados por titulo. */
export async function loadSamples(adminId: number): Promise<number> {
  let created = 0;
  for (const sample of SAMPLES) {
    const [dup] = await query<{ id: number }>(
      'SELECT id FROM scripts WHERE title = $1',
      [sample.title],
    );
    if (dup) continue;
    // El material de ejemplo lo publica el admin para todo el mundo.
    await createScript(sample, adminId, true);
    created++;
  }
  return created;
}
