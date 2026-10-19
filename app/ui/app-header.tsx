import type { ReactNode } from 'react';
import { logout } from '@/app/login/actions';

// Top bar on every signed in page: who you are, any page buttons, and Log out.
// `mark` = brand color for the round initial badge on client pages.
export function AppHeader({
  title,
  subtitle,
  userName,
  mark,
  children,
}: {
  title: string;
  subtitle: string;
  userName: string;
  mark?: string;
  children?: ReactNode;
}) {
  return (
    <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        {mark && (
          <div className="grid size-11 shrink-0 place-items-center rounded-full text-xl font-extrabold text-[#111]" style={{ background: mark }}>
            {title.charAt(0).toUpperCase()}
          </div>
        )}
        <div>
          <h1 className="text-[22px] font-bold">{title}</h1>
          <p className="mt-0.5 text-xs text-dim">{subtitle}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-xs text-dim">Signed in as {userName}</span>
        {children}
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
