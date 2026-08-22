'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  createScript, updateScript, deleteScript, setScriptPublic,
  setCandidateEnabled, reanalyzeScript,
} from '@/lib/scripts';
import { buildQuiz, gradeAttempt } from '@/lib/quiz';
import { addCard, removeCard, reviewCard, setSuspended } from '@/lib/flashcards';
import { requireUser, requireAdmin, login, logout } from '@/lib/auth';
import { createUser, setPassword, setActive, setRole, deleteUser } from '@/lib/users';
import type { Grade } from '@/lib/srs';
import type { AttemptResult, Quiz, QuizConfig } from '@/lib/types';

export interface FormState {
  error?: string;
  ok?: string;
}

function fail(err: unknown, fallback: string): FormState {
  return { error: err instanceof Error ? err.message : fallback };
}

// ------------------------------------------------------------------ sesion

export async function loginAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const username = String(fd.get('username') ?? '');
  const password = String(fd.get('password') ?? '');
  if (!username || !password) return { error: 'Usuario y contrasena son obligatorios.' };

  const user = await login(username, password);
  if (!user) return { error: 'Usuario o contrasena incorrectos.' };
  redirect('/');
}

export async function logoutAction(): Promise<void> {
  await logout();
  redirect('/login');
}

// ----------------------------------------------------------------- scripts

function readForm(fd: FormData) {
  return {
    title: String(fd.get('title') ?? '').trim(),
    topic: String(fd.get('topic') ?? '').trim() || null,
    level: String(fd.get('level') ?? '').trim() || null,
    source: String(fd.get('source') ?? '').trim() || null,
    notes: String(fd.get('notes') ?? '').trim() || null,
    raw: String(fd.get('raw') ?? ''),
  };
}

export async function createScriptAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const input = readForm(fd);
  if (!input.title) return { error: 'Ponle un titulo.' };
  if (!input.raw.trim()) return { error: 'Pega el texto del script.' };

  // Solo un admin puede marcar el script como publico al crearlo.
  const isPublic = user.role === 'admin' && fd.get('is_public') === 'on';

  let id: number;
  try {
    id = await createScript(input, user.id, isPublic);
  } catch (err) {
    return fail(err, 'Error al guardar.');
  }
  revalidatePath('/scripts');
  revalidatePath('/');
  redirect(`/scripts/${id}`);
}

export async function updateScriptAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const id = Number(fd.get('id'));
  const input = readForm(fd);
  if (!input.title) return { error: 'Ponle un titulo.' };
  if (!input.raw.trim()) return { error: 'Pega el texto del script.' };

  try {
    await updateScript(id, input, user);
    if (user.role === 'admin') {
      await setScriptPublic(id, fd.get('is_public') === 'on', user);
    }
  } catch (err) {
    return fail(err, 'Error al guardar.');
  }
  revalidatePath('/scripts');
  revalidatePath(`/scripts/${id}`);
  redirect(`/scripts/${id}`);
}

export async function deleteScriptAction(fd: FormData): Promise<void> {
  const user = await requireUser();
  await deleteScript(Number(fd.get('id')), user);
  revalidatePath('/scripts');
  revalidatePath('/');
  redirect('/scripts');
}

export async function togglePublicAction(fd: FormData): Promise<void> {
  const user = await requireAdmin();
  const id = Number(fd.get('id'));
  await setScriptPublic(id, fd.get('is_public') === 'true', user);
  revalidatePath(`/scripts/${id}`);
  revalidatePath('/scripts');
}

export async function toggleCandidateAction(candidateId: number, enabled: boolean, scriptId: number) {
  const user = await requireUser();
  await setCandidateEnabled(candidateId, enabled, user);
  revalidatePath(`/scripts/${scriptId}`);
}

export async function reanalyzeAction(fd: FormData): Promise<void> {
  const user = await requireUser();
  const id = Number(fd.get('id'));
  await reanalyzeScript(id, user);
  revalidatePath(`/scripts/${id}`);
  revalidatePath('/scripts');
}

export async function loadSamplesAction(): Promise<void> {
  const user = await requireAdmin();
  const { loadSamples } = await import('@/lib/samples');
  await loadSamples(user.id);
  revalidatePath('/scripts');
  revalidatePath('/');
  redirect('/scripts');
}

// ------------------------------------------------------------------ examen

export async function startQuizAction(config: QuizConfig): Promise<{ quiz?: Quiz; error?: string }> {
  const user = await requireUser();
  try {
    return { quiz: await buildQuiz(config, user) };
  } catch (err) {
    return fail(err, 'No se pudo armar el examen.');
  }
}

export async function submitQuizAction(
  attemptId: number,
  answers: Record<string, string>,
): Promise<{ result?: AttemptResult; error?: string }> {
  const user = await requireUser();
  try {
    const result = await gradeAttempt(attemptId, answers, user.id);
    revalidatePath('/');
    return { result };
  } catch (err) {
    return fail(err, 'No se pudo corregir.');
  }
}

// -------------------------------------------------------------- flashcards

export async function reviewCardAction(
  flashcardId: number,
  grade: Grade,
  typedAnswer: string | null,
): Promise<void> {
  const user = await requireUser();
  await reviewCard(flashcardId, grade, typedAnswer, user.id);
  revalidatePath('/flashcards');
  revalidatePath('/');
}

export async function addCardAction(candidateId: number): Promise<void> {
  const user = await requireUser();
  await addCard(candidateId, user.id);
  revalidatePath('/flashcards');
}

export async function removeCardAction(fd: FormData): Promise<void> {
  const user = await requireUser();
  await removeCard(Number(fd.get('id')), user.id);
  revalidatePath('/flashcards');
}

export async function toggleSuspendAction(fd: FormData): Promise<void> {
  const user = await requireUser();
  await setSuspended(Number(fd.get('id')), fd.get('suspended') === 'true', user.id);
  revalidatePath('/flashcards');
}

// ------------------------------------------------------------------- admin

export async function createUserAction(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  try {
    await createUser({
      username: String(fd.get('username') ?? ''),
      name: String(fd.get('name') ?? ''),
      password: String(fd.get('password') ?? ''),
      role: fd.get('role') === 'admin' ? 'admin' : 'user',
    });
  } catch (err) {
    return fail(err, 'No se pudo crear el usuario.');
  }
  revalidatePath('/admin');
  return { ok: 'Usuario creado.' };
}

export async function setPasswordAction(fd: FormData): Promise<void> {
  const me = await requireUser();
  const userId = Number(fd.get('id'));
  // Un usuario normal solo puede cambiar su propia contrasena.
  if (me.role !== 'admin' && me.id !== userId) throw new Error('No autorizado.');

  await setPassword(userId, String(fd.get('password') ?? ''));
  revalidatePath('/admin');
  // Cambiar la clave invalida las sesiones: si era la tuya, toca volver a entrar.
  if (me.id === userId) redirect('/login');
}

export async function setActiveAction(fd: FormData): Promise<void> {
  await requireAdmin();
  await setActive(Number(fd.get('id')), fd.get('active') === 'true');
  revalidatePath('/admin');
}

export async function setRoleAction(fd: FormData): Promise<void> {
  await requireAdmin();
  await setRole(Number(fd.get('id')), fd.get('role') === 'admin' ? 'admin' : 'user');
  revalidatePath('/admin');
}

export async function deleteUserAction(fd: FormData): Promise<void> {
  const me = await requireAdmin();
  const id = Number(fd.get('id'));
  if (id === me.id) throw new Error('No puedes borrarte a ti mismo.');
  await deleteUser(id);
  revalidatePath('/admin');
}
