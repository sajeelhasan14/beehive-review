import { logout } from '@/app/login/actions';

// Top bar on every signed in page: who you are, and Log out.
export function AppHeader({ title, subtitle, userName }: { title: string; subtitle: string; userName: string }) {
  return (
    <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-[22px] font-bold">{title}</h1>
        <p className="mt-0.5 text-xs text-dim">{subtitle}</p>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-dim">Signed in as {userName}</span>
        <form action={logout}>
          <button
            type="submit"
            className="rounded-lg border border-border bg-surface2 px-2.5 py-1.5 text-xs font-medium hover:border-dim"
          >
            Log out
          </button>
        </form>
      </div>
    </header>
  );
}
