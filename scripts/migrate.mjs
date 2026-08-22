// Corre las migraciones pendientes de /migrations. Mismo patron que laoficina:
// tabla _migrations de control, orden alfabetico, una transaccion por archivo.
// Uso: npm run migrate
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(here, '..');
const MIGRATIONS_DIR = path.join(ROOT, 'migrations');

// dotenv solo hace falta en local para leer .env.local. Dentro del contenedor
// las variables llegan del entorno y el paquete puede no estar trazado, asi que
// su ausencia no debe romper el arranque.
try {
  const dotenv = await import('dotenv');
  dotenv.default.config({ path: path.join(ROOT, '.env.local') });
} catch {
  // sin dotenv: se usa process.env tal cual
}

const DB_NAME = process.env.DB_NAME || 'easycake';
const baseConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
};

// La base puede no existir todavia: conectamos a `postgres` y la creamos.
// En un servidor con Postgres compartido puede que el usuario no tenga permiso
// para CREATE DATABASE, o que la base ya este creada a mano. En ese caso esto
// no es un error: se sigue y el fallo real aparecera al conectarse a la base.
async function ensureDatabase() {
  let admin;
  try {
    admin = new pg.Client({ ...baseConfig, database: 'postgres' });
    await admin.connect();
    const { rowCount } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [DB_NAME]);
    if (!rowCount) {
      // CREATE DATABASE no acepta parametros; el nombre viene del entorno, no de input de usuario.
      await admin.query(`CREATE DATABASE "${DB_NAME}"`);
      console.log(`[migrations] base "${DB_NAME}" creada`);
    }
  } catch (err) {
    console.warn(`[migrations] no se pudo verificar/crear la base (${err.code || err.message}); se continua`);
  } finally {
    await admin?.end().catch(() => {});
  }
}

async function runMigrations(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id          SERIAL PRIMARY KEY,
      nombre      VARCHAR(255) NOT NULL UNIQUE,
      aplicada_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const archivos = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
  if (!archivos.length) {
    console.log('[migrations] sin archivos .sql');
    return;
  }

  const { rows: aplicadas } = await pool.query('SELECT nombre FROM _migrations');
  const yaEstan = new Set(aplicadas.map((r) => r.nombre));
  const pendientes = archivos.filter((f) => !yaEstan.has(f));

  if (!pendientes.length) {
    console.log('[migrations] todo al dia');
    return;
  }

  const client = await pool.connect();
  try {
    for (const archivo of pendientes) {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, archivo), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO _migrations (nombre) VALUES ($1)', [archivo]);
        await client.query('COMMIT');
        console.log(`[migrations] ok ${archivo}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[migrations] FALLO ${archivo} (${err.code}): ${err.message}`);
        throw err;
      }
    }
  } finally {
    client.release();
  }
}

await ensureDatabase();
const pool = new pg.Pool({ ...baseConfig, database: DB_NAME });
try {
  await runMigrations(pool);
} finally {
  await pool.end();
}
