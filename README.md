# EasyCake

Plataforma multiusuario para estudiar ingles a partir de tus propios scripts y
dialogos: los guardas una vez, la app decide que palabras vale la pena tapar, y
el modo examen genera un fill-in-the-blank distinto cada vez. Lo que fallas se
convierte solo en flashcards.

## Usuarios y material publico

Cada persona tiene lo suyo: **scripts, intentos, estadisticas y flashcards son
por usuario**. Dos personas practicando el mismo dialogo tienen progreso
completamente independiente.

| | usuario | admin |
|---|---|---|
| Crear y editar sus scripts | si | si |
| Ver scripts publicos | si | si |
| Editar un script ajeno | no | si |
| Publicar un script para todos | no | si |
| Crear / borrar / desactivar usuarios | no | si |

**Publicar** un script lo pone a disposicion de todo el mundo para practicarlo,
pero seguir siendo editable solo por su dueno: un lector no cura material ajeno
(descartar un hueco cambiaria el script para todos). Su progreso, en cambio, si
es suyo — `candidate_stats` y `flashcards` llevan el usuario en la clave.

El sistema no se puede quedar sin acceso: no se permite borrar, desactivar ni
degradar al ultimo administrador activo.

### Sesiones

Cookie httpOnly + tabla `sessions` en base, no JWT. La razon: permite cerrar la
sesion de alguien de verdad borrando la fila, en vez de esperar a que expire un
token que ya no controlas. Cambiar una contrasena o desactivar un usuario cierra
sus sesiones al instante.

El middleware solo mira si **existe** la cookie (corre en el edge runtime y no
puede consultar Postgres); la validacion real —que la sesion exista, no haya
vencido y el usuario siga activo— vive en `requireUser()`, que llaman todas las
paginas, y en cada server action.

## Como funciona

El sistema tiene dos motores independientes. El CRUD es lo de menos.

### 1. Analizador (`src/lib/analyzer/`)

Corre **una sola vez, al guardar el script**. Recorre cada linea y propone todos
los tramos que valen la pena tapar, guardando offsets (`start_pos`, `end_pos`),
no la palabra suelta — porque "the" aparece cuarenta veces en un dialogo.

Un texto de 600 palabras produce 60-90 candidatos. El examen despues muestrea
15 de esos 90, asi que **los huecos cambian en cada intento** sin necesidad de
volver a analizar nada.

Prioridad de deteccion (el que gana un solape es el de mas arriba):

| Prioridad | Categoria | Ejemplo | Dificultad |
|---|---|---|---|
| 100 | phrasal verb junto | `look up`, `sort out` | 5 |
| 95 | phrasal separado (se tapa la particula) | `look it __` | 4 |
| 90 | preposicion dependiente | `interested __`, `depend __` | 4 |
| 80 | conector del discurso | `however`, `although` | 4 |
| 70 | forma verbal irregular | `brought`, `taken` | 3 |
| 60 | modal | `would`, `might` | 3 |
| 50 | vocabulario poco frecuente | fuera de las listas de frecuencia | 3-5 |
| 30 | contraccion | `I'm`, `won't` | 2 |
| 20 | vocabulario frecuente | esta en el tier 2 | 2 |

Nunca se tapan: stopwords sueltas, nombres propios (mayuscula fuera de inicio de
oracion), el nombre del hablante, palabras de menos de 4 letras, ni nada en una
linea de menos de 4 palabras (no hay contexto del que deducir).

Las listas lexicas viven en `src/lib/analyzer/wordlists.ts` y `phrasals.ts`.
Editarlas y correr **Re-analizar** en un script aplica los cambios.

### 2. Correccion (`src/lib/grading.ts`)

`===` no sirve. La cascada es:

1. match exacto normalizado (minusculas, sin puntuacion de borde)
2. respuestas alternativas (`angry at` / `angry with`)
3. equivalencia de contracciones en ambos sentidos (`I'm` = `I am`)
4. **Levenshtein <= 1** en respuestas de 4+ caracteres → veredicto `typo`:
   cuenta como acierto y te muestra la forma exacta
5. incorrecto

El paso 4 es el que evita que la app sea insoportable: escribir `recieve` no es
lo mismo que no saber la palabra.

Las respuestas **nunca viajan al cliente** al armar el quiz. La correccion pasa
en el servidor (`gradeAttempt`), por eso el examen se corrige al enviarlo.

### 3. Repeticion espaciada

Cada hueco acertado o fallado se acumula en `candidate_stats`. El muestreo pondera:

```
w  = 0.6 + 0.15 * dificultad
w *= 1.4                        si nunca lo has visto
w *= 1 + 2 * (fallos / vistas)  hasta 3x si siempre lo fallas
w *= 0.75 ^ aciertos_seguidos   se aparta lo que ya dominas
w *= 0.5                        si lo viste hace menos de 24h
```

## Modos de examen

- **Mezcla general** — toma pasajes de 4-8 turnos consecutivos de varios scripts.
  Deliberadamente **no** mezcla frases sueltas: sin el hilo de la conversacion
  un fill-in-the-blank deja de tener respuesta deducible.
- **Un script** — el dialogo completo.
- **Un solo rol** — se tapan solo los turnos de un hablante y el resto queda
  visible, que es como se practica un script en la vida real.

Dificultad: **facil** (banco de palabras arriba), **medio** (inicial + longitud,
`l___ u_`), **dificil** (hueco vacio, sin pistas de longitud).
Densidad: 10% / 20% / 30% de las palabras.

## Puesta en marcha

Requiere el container de Postgres corriendo en `localhost:5432`.

```bash
npm install
npm run migrate     # crea la base easycake y aplica migrations/
npm run dev
```

Credenciales de la base en `.env.local`. La base se crea sola si no existe.

**Primer acceso:** usuario `admin`, contrasena `easycake2026`. Cambiala desde
**Admin** en cuanto entres — el hash inicial esta en `migrations/003_users.sql`,
o sea que es publico para cualquiera que vea el repo.

Desde **Admin** creas el resto de usuarios. El boton **Cargar ejemplos** (solo
admin) mete tres dialogos publicos B1/B2/A2 para probar sin escribir nada.

## Despliegue

Ver **[DEPLOY_EASYPANEL.md](DEPLOY_EASYPANEL.md)**. Resumen: Dockerfile
multi-stage con `output: standalone`, Postgres compartido del servidor (no se
levanta uno propio), y `scripts/start.mjs` que en cada arranque espera a la
base, aplica migraciones pendientes y ajusta la contrasena del admin antes de
servir. Sonda en `/api/health`.

```bash
cp .env.example .env
docker compose up -d --build
```

## Formato de entrada

Un turno por linea:

```
Man: Hey, did you manage to sort out the tickets?
Woman: Not yet. I've been trying to get through to them.
```

Tambien acepta `WOMAN:`, `[Narrator]`, y numeracion (`1. Tom: ...`).
Una linea sin dos puntos se guarda como narracion.

## Estructura

```
Dockerfile                   imagen de produccion (multi-stage, standalone)
docker-compose.yml           solo la app; el Postgres es el compartido del server
.env.example                 plantilla de variables
DEPLOY_EASYPANEL.md          guia de despliegue
scripts/start.mjs            arranque: espera base, migra, admin, sirve
migrations/001_init.sql      esquema base
migrations/002_flashcards.sql mazo y repasos
migrations/003_users.sql     multiusuario y scripts publicos
scripts/migrate.mjs          runner de migraciones (patron laoficina)
src/middleware.ts            filtro barato de cookie (edge)
src/lib/analyzer/            motor de deteccion de huecos
src/lib/grading.ts           motor de correccion
src/lib/srs.ts               programacion de repasos (compartido cliente/servidor)
src/lib/quiz.ts              armado del examen + muestreo ponderado + stats
src/lib/flashcards.ts        mazo y repasos
src/lib/scripts.ts           CRUD + reglas de visibilidad (canView / canEdit)
src/lib/auth.ts              sesion y control de acceso
src/lib/users.ts             CRUD de usuarios (sin Next: testeable suelto)
src/lib/parse.ts             parser del texto pegado
src/app/                     paginas (App Router) y server actions
src/components/              formulario, lector, configurador, runner, admin
```

## Notas de diseno

**Editar un script no borra tu historial.** `updateScript` empareja las lineas
viejas con las nuevas por texto exacto: una linea intacta conserva su id, sus
candidatos y sus estadisticas. Solo se re-analiza lo que realmente cambio.

**Los candidatos se pueden curar a mano.** En la vista de un script, cada palabra
subrayada se apaga con un click. Con un analizador heuristico siempre habra algun
hueco que no vale la pena, y descartarlo es mas rapido que afinar las listas.

**La autorizacion se aplica en el servidor, no en la UI.** Los botones se
esconden segun el rol, pero eso es cosmetica: cada server action llama a
`requireUser()` / `requireAdmin()` y cada mutacion lleva el `user_id` en el
`WHERE`. Corregir un intento ajeno, editar un script ajeno o tocar el mazo de
otro fallan aunque se adivinen los ids.

**Enchufar una IA es un cambio local.** Si mas adelante quieres que Claude elija
los huecos en vez de las heuristicas, el unico contrato que hay que respetar es
`analyzeLine(text, speaker) -> RawCandidate[]`. El resto de la app —muestreo,
correccion, estadisticas— no se entera.
