// Arranque del contenedor de produccion:
//   1. aplica migraciones pendientes
//   2. ajusta la contrasena del admin si sigue siendo la de fabrica
//   3. levanta el servidor de Next (build standalone)
//
// Se hace aqui y no en el Dockerfile para que un redeploy que traiga una
// migracion nueva la aplique solo, sin pasos manuales en el servidor.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import bcrypt from 'bcryptjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(here, '..');

// Hash sembrado por migrations/003_users.sql. Es publico (esta en el repo), por
// eso se reemplaza en el primer arranque si ADMIN_PASSWORD viene definida.
const DEFAULT_ADMIN_HASH = '$2b$10$zc4WujwPWCwHyCqpSKBhJeDDJ4gg5lQdO6uc/0vTBhgVtyAO1jfIW';

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'easycake',
};

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: ROOT, stdio: 'inherit', env: process.env });
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} salio con ${code}`))));
    child.on('error', reject);
  });
}

/** Pistas accionables por codigo de error, para no tener que adivinar. */
function explain(err) {
  const code = err.code || '';
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
    return `DB_HOST="${dbConfig.host}" no resuelve. Es el nombre del servicio de
       Postgres en EasyPanel, y ambos servicios tienen que estar en el MISMO
       proyecto/red. Copia el DB_HOST de otra app tuya que ya conecte.`;
  }
  if (code === 'ECONNREFUSED') {
    return `Hay DNS pero nadie escucha en ${dbConfig.host}:${dbConfig.port}.
       Revisa DB_PORT y que el servicio de Postgres este arriba.`;
  }
  if (code === 'ETIMEDOUT') {
    return 'La conexion expira: normalmente la app y Postgres estan en redes distintas.';
  }
  if (code === '28P01' || code === '28000') {
    return `Postgres responde pero rechaza al usuario "${dbConfig.user}": revisa DB_USER y DB_PASSWORD.`;
  }
  if (code === '3D000') {
    return `Postgres responde pero la base "${dbConfig.database}" no existe todavia.`;
  }
  return 'Revisa DB_HOST, DB_PORT, DB_USER y DB_PASSWORD.';
}

/**
 * Espera a que Postgres acepte conexiones.
 *
 * Sondea la base de la APLICACION, no la de mantenimiento: hay instalaciones
 * donde el usuario no puede entrar a `postgres`, y exigirlo haria fallar un
 * arranque que en realidad podria funcionar. Si la respuesta es 3D000 (la base
 * no existe) el servidor esta perfectamente vivo y contestando, que es lo unico
 * que se estaba esperando: crearla es tarea de las migraciones.
 */
async function waitForPostgres(attempts = 20) {
  for (let i = 1; i <= attempts; i++) {
    const client = new pg.Client({ ...dbConfig, connectionTimeoutMillis: 5000 });
    try {
      await client.connect();
      await client.end();
      console.log(`[start] Postgres responde en ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);
      return;
    } catch (err) {
      await client.end().catch(() => {});

      if (err.code === '3D000') {
        console.log(`[start] Postgres responde; la base "${dbConfig.database}" aun no existe, se creara`);
        return;
      }
      // Credenciales malas: reintentar 20 veces no las va a arreglar.
      if (err.code === '28P01' || err.code === '28000') {
        throw new Error(`[start] ${explain(err)}
[start] (${err.code}) ${err.message}`);
      }

      // El motivo se imprime SIEMPRE, no solo al agotar los intentos: un log de
      // 20 lineas identicas sin causa no sirve para diagnosticar nada.
      console.log(
        `[start] intento ${i}/${attempts} — no se pudo conectar a ` +
        `${dbConfig.host}:${dbConfig.port} (${err.code || 'sin codigo'}): ${err.message}`,
      );
      if (i === 1) console.log(`[start] ${explain(err)}`);
      if (i === attempts) {
        throw new Error(`[start] Postgres no respondio tras ${attempts} intentos. ${explain(err)}`);
      }
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

/**
 * Si el admin sigue con el hash de fabrica y hay ADMIN_PASSWORD, se cambia.
 * Es idempotente: en cuanto la contrasena deja de ser la por defecto (porque la
 * cambiaste desde /admin), este paso no vuelve a tocar nada.
 */
async function bootstrapAdmin() {
  const password = process.env.ADMIN_PASSWORD;
  const client = new pg.Client(dbConfig);
  await client.connect();
  try {
    const { rows } = await client.query(
      "SELECT id, password_hash FROM users WHERE username = 'admin'",
    );
    if (!rows.length) return;

    const usesDefault = rows[0].password_hash === DEFAULT_ADMIN_HASH;

    if (!password) {
      if (usesDefault) {
        console.warn(
          '[start] AVISO: el admin conserva la contrasena por defecto del repositorio.\n' +
          '[start]        Define ADMIN_PASSWORD, o cambiala desde /admin cuanto antes.',
        );
      }
      return;
    }
    if (!usesDefault) return;

    if (password.length < 6) {
      console.warn('[start] ADMIN_PASSWORD tiene menos de 6 caracteres; se ignora.');
      return;
    }
    const hash = await bcrypt.hash(password, 10);
    await client.query('UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1', [
      rows[0].id, hash,
    ]);
    await client.query('DELETE FROM sessions WHERE user_id = $1', [rows[0].id]);
    console.log('[start] contrasena del admin tomada de ADMIN_PASSWORD');
  } finally {
    await client.end();
  }
}

console.log(
  `[start] destino: ${dbConfig.user}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`,
);
await waitForPostgres();
await run(process.execPath, [path.join(ROOT, 'scripts', 'migrate.mjs')]);
await bootstrapAdmin();

console.log('[start] arrancando Next en el puerto', process.env.PORT || 3000);
// server.js es el que genera `output: standalone`. Se reemplaza el proceso para
// que las senales (SIGTERM de docker stop) lleguen directas a Next.
await run(process.execPath, [path.join(ROOT, 'server.js')]);
