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

/**
 * Espera a que Postgres acepte conexiones. En un compose el contenedor de la
 * app suele arrancar antes que la base; sin esto el primer deploy falla y hay
 * que reintentarlo a mano.
 *
 * Se conecta a la base `postgres`, NO a la de la aplicacion: en el primer
 * arranque esa todavia no existe (la crean las migraciones), y esperar por ella
 * seria esperar para siempre.
 */
async function waitForPostgres(attempts = 30) {
  for (let i = 1; i <= attempts; i++) {
    const client = new pg.Client({ ...dbConfig, database: 'postgres' });
    try {
      await client.connect();
      await client.end();
      return;
    } catch (err) {
      await client.end().catch(() => {});
      if (i === attempts) throw new Error(`Postgres no respondio tras ${attempts} intentos: ${err.message}`);
      console.log(`[start] esperando a Postgres (${i}/${attempts})...`);
      await new Promise((r) => setTimeout(r, 2000));
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

await waitForPostgres();
await run(process.execPath, [path.join(ROOT, 'scripts', 'migrate.mjs')]);
await bootstrapAdmin();

console.log('[start] arrancando Next en el puerto', process.env.PORT || 3000);
// server.js es el que genera `output: standalone`. Se reemplaza el proceso para
// que las senales (SIGTERM de docker stop) lleguen directas a Next.
await run(process.execPath, [path.join(ROOT, 'server.js')]);
