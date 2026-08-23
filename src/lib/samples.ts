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
  {
    title: 'Born to be an athlete',
    topic: 'Deporte / biografia',
    level: 'B1',
    source: 'Script de clase',
    notes: null,
    raw: `My parents always said I was born to be an athlete.
They say I wasn't happy unless I was kicking a ball.
My first memory is of Dad and I playing football in our back garden.
As I grew up, I dreamt of becoming a football player.
My big break came when I was 18.
Winnipeg City FC offered me a place in the squad.
It was there that I learnt the true value of teamwork.
I was excited about working with new people and making new friends.
My time at Winnipeg FC was an enriching experience.
It wasn't long until I was on a new journey, this time to play for Calgary FC.
I was nervous at first, but it turned out that there was no reason to panic.
I understood that I always have to do my best.
That's why I'm trying so hard here at the Canadian Alliance.`,
  },
  {
    title: 'Decisions',
    topic: 'Transporte / comparativos',
    level: 'A2',
    source: 'Script de clase',
    notes: null,
    raw: `Well, I think I'm ready to go!
OK, let's go! Our chalet is three hours away.
Three hours away? Are we going by turtle?
You're kidding! We're going on foot.
No way, I have a car and I'm going by car. That's final!
Going by car to the mountains? The road is not that safe because of the rain.
OK, let's go by motorcycle, it's faster than your car.
It's raining cats and dogs. Do you want to get the flu?
But we can also catch a cold if we go on foot.
Yes, it's true. So what?
Let's go by bus up to the village and then we can walk.
Yes, going by bus is cheaper than going by car.
And leaving right now is better than staying here arguing.`,
  },
  {
    title: 'Dictation 1 - reunion de trabajo',
    topic: 'Reuniones / oficina',
    level: 'B1',
    source: 'Dictado de clase',
    notes: 'Frases sueltas de dictado, no un dialogo continuo.',
    raw: `Good morning, everyone.
And at what time of the day?
This means it's been scheduled for the first week of May.
These task lists are not comprehensive.
Sara, what's first on our agenda?
If there's anything official you want communicated to the group.
Sara will separate the task list.
Any objections?
For the thirty-second annual International Relations Seminar.
These meetings have been held on Wednesdays at noon every other week.`,
  },
  {
    title: 'Dictation 2 - anecdota en un bar',
    topic: 'Anecdota / condicionales',
    level: 'B2',
    source: 'Dictado de clase',
    notes: 'Frases sueltas de dictado, no un dialogo continuo.',
    raw: `He was standing there for about fifteen minutes.
You girls are so beautiful.
If he didn't, I'd buy him drinks for the rest of the night.
What are you waiting for? Go out there and say something.
What's the worst that could happen? It's a win-win situation.
If it had been me, you could just tell them it was my fault.
I was at a bar last week with my friend.
I said, "Don't be such a wimp."
Finally, I realized why.
He is a decent-looking guy, but he's really shy around girls for some reason.`,
  },
  {
    title: "I'm good at sports",
    topic: 'Deporte / discusion',
    level: 'B1',
    source: 'Script de clase',
    notes: null,
    raw: `Did you see the Marathon yesterday?
Yes. It's the biggest athletic event in the city.
How many people on average run the Marathon each year?
I'm not sure. I think more than 20,000 people.
And why didn't you run the Marathon?
Because I get cramps every time I run.
Really? I think it is because of your lack of training.
I don't think so. You know I play tennis and go mountain biking every week.
C'mon! You go to meet girls at the tennis court and the bike is only for riding to your office.
Never judge a book by its cover; I'm very good at sports.
Yes, and you are very good at sleeping, eating and loafing around.
You don't believe me? Let's run our own marathon, just you and me.
No way! I won't bother to go running with you.`,
  },
  {
    title: 'Dictation 3 - entrevista telefonica',
    topic: 'Trabajo / entrevista',
    level: 'B2',
    source: 'Dictado de clase',
    notes: 'Frases sueltas de dictado, no un dialogo continuo.',
    raw: `Can I please speak with Mr. Mark Cantor?
Well, I've been studying politics at university and I'm graduating this May.
Can you tell me about why you are interested in working at our office?
What can you say about your strengths and weaknesses?
And can you tell me a little about your previous experiences?
All right then, let's get started, shall we?
My most recent job was working at the school's newspaper.
Hello, may I ask who's calling?
I'm looking for a job that has me intimately involved with the legislative process.
I have a phone interview with this office scheduled for now.`,
  },
  {
    title: "Don't call me stupid",
    topic: 'Oficina / jefe nuevo',
    level: 'B1',
    source: 'Script de clase',
    notes: null,
    raw: `It seems that we have a new boss.
Yes, we had to postpone the new projects.
What do you think the new boss is like?
I wish he were different from Mr. McDonnell.
Yes, he's not only gaining weight, but gaining problems as well.
Yes, he was involved in many problems regarding money.
And more than that, one day he called me stupid. Can you imagine?
I can. I have called you stupid before.
But you are my friend and he is not.
It is true. Look. Here's an e-mail announcing the new boss.
I hope it's you. I voted for you.
No way, you won the election, you are the new boss.
Great! Don't call me stupid again.`,
  },
  {
    title: 'Dictation 4 - la propuesta robada',
    topic: 'Oficina / anecdota',
    level: 'B2',
    source: 'Dictado de clase',
    notes: 'Frases sueltas de dictado, no un dialogo continuo.',
    raw: `And when the boss comes around.
I worked really hard on a marketing proposal for work.
I was so pissed off.
Left it on my desk and took a bathroom break.
Just talks to girls all day on his MSN messenger account.
Jeff had apparently taken the proposal off my desk and showed the boss.
I printed out my proposal.
I wanted to impress the boss with all the effort I'd been putting in.
That he isn't totally worthless.
Just sit around the office all day accomplishing next to nothing.`,
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
