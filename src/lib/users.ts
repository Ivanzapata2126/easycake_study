import 'server-only';
import bcrypt from 'bcryptjs';
import { query } from './db';

// CRUD de usuarios, sin nada de Next. Separado de auth.ts a proposito: aquel
// depende de cookies() y redirect(), que solo existen dentro del runtime de
// Next y hacen imposible ejercitar esta logica desde un script suelto.

export interface User {
  id: number;
  username: string;
  name: string | null;
  role: 'admin' | 'user';
  active: boolean;
  created_at: string;
}

export interface UserWithCounts extends User {
  scripts: number;
  attempts: number;
  cards: number;
  last_seen: string | null;
}

export async function listUsers(): Promise<UserWithCounts[]> {
  return query<UserWithCounts>(`
    SELECT u.id, u.username, u.name, u.role, u.active, u.created_at,
           (SELECT COUNT(*) FROM scripts    WHERE user_id = u.id)::int AS scripts,
           (SELECT COUNT(*) FROM attempts   WHERE user_id = u.id AND finished_at IS NOT NULL)::int AS attempts,
           (SELECT COUNT(*) FROM flashcards WHERE user_id = u.id)::int AS cards,
           (SELECT MAX(created_at) FROM sessions WHERE user_id = u.id) AS last_seen
      FROM users u
     ORDER BY u.role, u.username
  `);
}

export async function findByUsername(username: string): Promise<(User & { password_hash: string }) | null> {
  const [row] = await query<User & { password_hash: string }>(
    'SELECT * FROM users WHERE lower(username) = lower($1) AND active',
    [username.trim()],
  );
  return row ?? null;
}

export async function createUser(input: {
  username: string;
  name?: string | null;
  password: string;
  role: 'admin' | 'user';
}): Promise<number> {
  const username = input.username.trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,60}$/.test(username)) {
    throw new Error('El usuario admite letras, numeros, punto, guion y guion bajo (3-60).');
  }
  if (input.password.length < 6) throw new Error('La contrasena debe tener al menos 6 caracteres.');

  const [dup] = await query<{ id: number }>('SELECT id FROM users WHERE username = $1', [username]);
  if (dup) throw new Error('Ese usuario ya existe.');

  const hash = await bcrypt.hash(input.password, 10);
  const [row] = await query<{ id: number }>(
    'INSERT INTO users (username, name, password_hash, role) VALUES ($1,$2,$3,$4) RETURNING id',
    [username, input.name?.trim() || null, hash, input.role],
  );
  return row.id;
}

export async function setPassword(userId: number, password: string): Promise<void> {
  if (password.length < 6) throw new Error('La contrasena debe tener al menos 6 caracteres.');
  const hash = await bcrypt.hash(password, 10);
  await query('UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1', [userId, hash]);
  // Cambiar la clave cierra las sesiones abiertas de esa persona.
  await query('DELETE FROM sessions WHERE user_id = $1', [userId]);
}

export async function setActive(userId: number, active: boolean): Promise<void> {
  if (!active) await guardLastAdmin(userId, 'desactivar');
  await query('UPDATE users SET active = $2, updated_at = NOW() WHERE id = $1', [userId, active]);
  if (!active) await query('DELETE FROM sessions WHERE user_id = $1', [userId]);
}

export async function setRole(userId: number, role: 'admin' | 'user'): Promise<void> {
  if (role !== 'admin') await guardLastAdmin(userId, 'quitarle el rol de admin a');
  await query('UPDATE users SET role = $2, updated_at = NOW() WHERE id = $1', [userId, role]);
}

export async function deleteUser(userId: number): Promise<void> {
  await guardLastAdmin(userId, 'borrar');
  await query('DELETE FROM users WHERE id = $1', [userId]);
}

/** No dejar el sistema sin ningun admin activo con el que poder entrar. */
async function guardLastAdmin(userId: number, action: string): Promise<void> {
  const [target] = await query<{ role: string }>('SELECT role FROM users WHERE id = $1', [userId]);
  if (target?.role !== 'admin') return;

  const [{ n }] = await query<{ n: string }>(
    "SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND active AND id <> $1",
    [userId],
  );
  if (Number(n) === 0) throw new Error(`No puedes ${action} al ultimo administrador activo.`);
}
