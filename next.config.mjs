import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Imagen de produccion minima: Next empaqueta el servidor y solo las
  // dependencias que realmente traza, en .next/standalone.
  output: 'standalone',
  serverExternalPackages: ['pg', 'bcryptjs'],
  // Hay un package-lock.json suelto en C:\Users\ivanz que Next elige como raiz
  // del workspace. Se ancla aqui para que el file tracing no salga del proyecto.
  outputFileTracingRoot: here,
};

export default nextConfig;
