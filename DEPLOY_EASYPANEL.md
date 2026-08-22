# Despliegue en EasyPanel

Guía para subir **EasyCake** al servidor. Mismo flujo que `laoficina` y
`qpocoton_pos`: **no se crea un Postgres nuevo**, se usa el único que ya tienes
en EasyPanel. EasyCake solo añade su propia base dentro de ese Postgres.

A diferencia de La Oficina, aquí sí hay un paso de build (Next.js), pero lo
resuelve el Dockerfile. Las migraciones y el usuario admin se aplican **solos**
en cada arranque (`scripts/start.mjs`), así que no hay que pegar SQL a mano.

---

## Prerrequisitos

- El código en GitHub: <https://github.com/Ivanzapata2126/easycake_study>
- Tu servicio de Postgres corriendo en EasyPanel.
- **El nombre interno de ese servicio de Postgres.** Es el valor que va en
  `DB_HOST`. Lo ves en EasyPanel, en el servicio de Postgres → pestaña
  *Credentials* / *Connection*: es el mismo host que ya usan `laoficina`
  (`oficina`) y `qpocoton_pos` (`restaurante_db`) para conectarse.

---

## Paso 1: la base de datos

**Normalmente no hay que hacer nada.** Tu Postgres ya existe y EasyCake crea
dentro de él su base `easycake` en el primer arranque, sin tocar `oficina` ni
`restaurante_db`. Solo hace falta que el usuario tenga permiso para
`CREATE DATABASE` (el usuario `postgres` lo tiene).

Si no lo tuviera, el log lo avisa y la creas a mano una vez, desde la
**Console** del servicio de Postgres:

```bash
psql -U postgres -c "CREATE DATABASE easycake;"
```

> Las **tablas** no hay que crearlas: la aplicación las genera al arrancar.
> Las migraciones ya aplicadas se omiten (tabla `_migrations`).

---

## Paso 2: la aplicación

1. **+ Add Service → App**
2. **General**:
   - **Name**: `easycake`
   - **Source**: Git Repository → `https://github.com/Ivanzapata2126/easycake_study.git`
   - **Branch**: `main`
   - **Build Method**: **Dockerfile**
3. **Environment Variables**:

   ```env
   NODE_ENV=production
   PORT=3000
   DB_HOST=el_nombre_de_tu_servicio_postgres
   DB_USER=postgres
   DB_PASSWORD=la_password_de_tu_postgres
   DB_NAME=easycake
   DB_PORT=5432
   COOKIE_SECURE=true
   ADMIN_PASSWORD=la_que_quieras_para_entrar
   ```

   - `DB_HOST` es el **nombre interno del servicio** de Postgres en EasyPanel,
     no una IP ni `localhost`. Es exactamente el mismo valor que ya tienen
     `laoficina` y `qpocoton_pos` en su `DB_HOST` — cópialo de ahí y no falla.
   - `DB_NAME=easycake` — **esto es lo único que cambia** respecto a tus otros
     proyectos. Comparten el mismo Postgres, cada uno con su base:
     `oficina`, `restaurante_db`, `easycake`.
   - `COOKIE_SECURE=true` porque EasyPanel sirve por HTTPS. **Si lo pones en
     true sirviendo por HTTP plano, el navegador descarta la cookie y el login
     parecerá que no funciona**, sin ningún error visible.
   - `ADMIN_PASSWORD`: ver el apartado siguiente. Ponla desde el primer deploy.

4. **Port Mapping**: Container Port `3000`. Asigna dominio o usa el subdominio
   de EasyPanel.
5. **Health Check** (opcional pero recomendado): path `/api/health`. Devuelve
   `200` solo si además de responder la app, Postgres contesta — un contenedor
   vivo pero sin base da `503` y no recibe tráfico.
6. **Deploy**.

No se necesitan volúmenes: no hay archivos subidos, todo está en Postgres.

---

## La contraseña del administrador

`migrations/003_users.sql` siembra el usuario `admin` con una contraseña que
**está escrita en el repositorio** (`easycake2026`). Sirve para arrancar en
local, pero en un servidor accesible desde internet no puede quedarse así.

Por eso el arranque hace esto:

- Si defines `ADMIN_PASSWORD` **y** el admin todavía tiene la contraseña de
  fábrica → la reemplaza antes de servir la primera petición.
- Si ya la cambiaste (desde `/admin` o por un deploy anterior) → **no la toca**.
  Puedes dejar la variable puesta sin miedo a que revierta tu contraseña en cada
  redeploy.
- Si no defines nada y sigue la de fábrica → sale un aviso en el log.

O sea: pon `ADMIN_PASSWORD` en el primer deploy y olvídate.

---

## Después del primer deploy

1. Entra con `admin` y la contraseña que pusiste.
2. **Admin → Crear usuario** para dar de alta a cada persona.
3. Los scripts que quieras compartir, créalos desde el admin y marca
   **Publicar para todos**. Cada usuario los practica con progreso propio:
   estadísticas y flashcards son independientes por persona.

---

## Correr con docker compose (fuera de EasyPanel)

`docker-compose.yml` levanta **solo la app** y espera encontrar la red del
Postgres compartido ya creada.

```bash
cp .env.example .env      # rellena DB_PASSWORD, ADMIN_PASSWORD, POSTGRES_NETWORK
docker compose up -d --build
docker compose logs -f
```

`POSTGRES_NETWORK` debe ser una red **definida por el usuario** en la que ya
esté el contenedor de Postgres, no `bridge` (ver la nota de `DB_HOST` arriba).
Para conectar un Postgres existente a una red:

```bash
docker network create postgres-net
docker network connect postgres-net <nombre-de-tu-contenedor-postgres>
```

Publica en el `3002` del host para no chocar con `laoficina` (3001).

---

## Qué pasa en cada arranque

`scripts/start.mjs`, en orden:

1. **Espera a Postgres** (30 intentos, 2 s). Se conecta a la base `postgres`, no
   a la de la app: en el primer arranque esa todavía no existe.
2. **Aplica migraciones pendientes** (`scripts/migrate.mjs`). Crea la base si
   hace falta y puede.
3. **Ajusta la contraseña del admin** si sigue siendo la de fábrica y hay
   `ADMIN_PASSWORD`.
4. **Levanta Next** (build standalone, `server.js`).

Si algo de 1–3 falla, el contenedor sale con error y el orquestador reintenta.
Es a propósito: es preferible que no arranque a que sirva con el esquema a
medias.

---

## Solución de problemas

| Síntoma | Causa probable |
|---|---|
| `esperando a Postgres (n/30)` sin fin | `DB_HOST` no resuelve: la app y Postgres no comparten una red definida por el usuario, o el nombre del contenedor no es ese |
| El login acepta pero vuelve a `/login` | `COOKIE_SECURE=true` sirviendo por HTTP plano |
| `/api/health` da 503 | La app está viva pero no llega a Postgres: revisa `DB_PASSWORD` y `DB_NAME` |
| No entra con `ADMIN_PASSWORD` | La contraseña ya se había cambiado antes; el arranque no la pisa. Cámbiala desde `/admin` con la sesión actual |
| Migración fallida al arrancar | El log dice cuál y por qué. El contenedor no arranca a propósito: el esquema quedaría inconsistente |
