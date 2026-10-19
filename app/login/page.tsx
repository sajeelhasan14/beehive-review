import { EmrgMark } from '@/app/ui/app-header';
import { LoginForm } from './login-form';

// One sign in page for everyone. Admins land on /admin, client users on /d/{their slug}.
export default function LoginPage() {
  return (
    <main className="flex min-h-[85vh] flex-col items-center justify-center px-5 py-12">
      <div className="mb-8 flex flex-col items-center gap-2 text-center">
        <EmrgMark size={56} />
        <div className="mt-1 font-serif text-[22px] font-bold tracking-[.02em]">EMRG Media</div>
        <div className="text-[10px] uppercase tracking-[.28em] text-dim">Beehive Reviews</div>
      </div>
      <div className="w-[380px] max-w-full rounded-2xl border border-border bg-surface p-8">
        <h1 className="font-serif text-[24px] font-bold leading-tight">Sign in</h1>
        <p className="mb-6 mt-1.5 text-[13px] text-dim">Your reviews, guests and alerts, in one place.</p>
        <LoginForm />
      </div>
    </main>
  );
}
