import LoginForm from '@/components/LoginForm';

export const dynamic = 'force-dynamic';

export default function LoginPage() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="text-center mb-7">
          <h1 className="text-3xl font-bold tracking-tight">
            Easy<span className="text-brand-400">Cake</span>
          </h1>
          <p className="text-ink-400 text-sm mt-2">
            Scripts, dialogos y examenes de ingles
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
