import { LoginForm } from './login-form';

// One sign in page for everyone. Admins land on /admin, client users on /d/{their slug}.
export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center p-5">
      <div className="w-[360px] max-w-full rounded-[14px] border border-border bg-surface p-7">
        <h1 className="text-xl font-bold">Beehive Reviews</h1>
        <p className="mb-5 mt-0.5 text-xs text-dim">Sign in, powered by EMRG Media</p>
        <LoginForm />
      </div>
    </main>
  );
}
