import type { ReactNode } from 'react';
import { logout } from '@/app/login/actions';

// EMRG's round black "E" mark, the house badge from emrg-media.html.
export function EmrgMark({ size = 36 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-full bg-text font-serif font-bold text-bg"
      style={{ width: size, height: size, fontSize: size * 0.43 }}
    >
      E
    </span>
  );
}

// Ink or white, whichever reads better on a client's brand color (light yellows get ink).
export function inkOn(hex: string): string {
  const n = Number.parseInt(hex.replace('#', ''), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b > 160 ? '#1b1a17' : '#ffffff';
}

const quiet = 'rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text hover:border-dim';

// Every signed in page: the EMRG bar (who you are, page buttons, Log out), then the page title.
// `mark` = client brand color, shown as their initial beside the title on client pages.
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
    <>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div className="flex items-center gap-2.5">
          <EmrgMark />
          <span className="leading-tight">
            <span className="block font-serif text-[15px] font-bold">Beehive Reviews</span>
            <span className="block text-[11px] text-dim">by EMRG Media</span>
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 hidden text-xs text-dim sm:inline">{userName}</span>
          {children}
          <form action={logout}>
            <button type="submit" className={quiet}>
              Log out
            </button>
          </form>
        </div>
      </div>

      <header className="mb-7 flex items-center gap-4">
        {mark && (
          <span
            aria-hidden
            className="grid size-12 shrink-0 place-items-center rounded-full font-serif text-xl font-bold ring-1 ring-black/5"
            style={{ background: mark, color: inkOn(mark) }}
          >
            {title.charAt(0).toUpperCase()}
          </span>
        )}
        <div>
          <h1 className="font-serif text-[28px] font-bold leading-tight tracking-[-0.01em]">{title}</h1>
          <p className="mt-1 text-[13px] text-dim">{subtitle}</p>
        </div>
      </header>
    </>
  );
}

export const headerButton = quiet;
