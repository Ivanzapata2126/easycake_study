import 'server-only';
import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import bcrypt from 'bcryptjs';
import { query } from './db';
import { SESSION_COOKIE } from './session';
import { findByUsername, type User } from './users';

// Sesion y control de acceso. El CRUD de usuarios vive en users.ts.
export { SESSION_COOKIE };
export type { User };
export type { UserWithCounts } from './users';

const SESSION_DAYS = 30;

// Detras de HTTPS la cookie debe ir `secure`. Pero si se marca secure sirviendo
// por HTTP plano, el navegador la descarta sin avisar y el login parece roto
// sin ningun error: por eso es una variable explicita y no NODE_ENV.
const COOKIE_SECURE = process.env.COOKIE_SECURE === 'true';

/** Usuario de la sesion actual, o null. No redirige: sirve para el layout. */
export async function getUser(): Promise<User | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const [row] = await query<User>(
    `SELECT u.id, u.username, u.name, u.role, u.active, u.created_at
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token = $1 AND s.expires_at > NOW() AND u.active`,
    [token],
  );
  return row ?? null;
}

/** Para paginas y acciones: si no hay sesion valida, al login. */
export async function requireUser(): Promise<User> {
  const user = await getUser();
  if (!user) redirect('/login');
  return user;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (user.role !== 'admin') redirect('/');
  return user;
}

export async function login(username: string, password: string): Promise<User | null> {
  const row = await findByUsername(username);

  // Se compara siempre, incluso sin usuario, para no delatar por tiempo de
  // respuesta cuales nombres existen.
  const hash = row?.password_hash ?? '$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv';
  const ok = await bcrypt.compare(password, hash);
  if (!row || !ok) return null;

  const token = randomBytes(32).toString('hex');
  await query(
    `INSERT INTO sessions (token, user_id, expires_at)
     VALUES ($1, $2, NOW() + ($3::int * INTERVAL '1 day'))`,
    [token, row.id, SESSION_DAYS],
  );

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
    secure: COOKIE_SECURE,
  });

  // Limpieza oportunista de sesiones vencidas: no hace falta un cron para esto.
  await query('DELETE FROM sessions WHERE expires_at < NOW()');

  const { password_hash: _drop, ...user } = row;
  return user;
}

export async function logout(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await query('DELETE FROM sessions WHERE token = $1', [token]);
  jar.delete(SESSION_COOKIE);
}
