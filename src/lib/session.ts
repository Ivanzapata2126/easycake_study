// Nombre de la cookie de sesion. Vive en su propio modulo sin dependencias
// porque lo necesitan tanto el middleware (edge runtime) como auth.ts (node),
// y auth.ts arrastra `pg`, que en el edge no puede cargarse.
export const SESSION_COOKIE = 'easycake_session';
