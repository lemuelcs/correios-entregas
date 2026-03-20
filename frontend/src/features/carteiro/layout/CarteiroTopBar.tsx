import type { ReactNode } from 'react';

interface CarteiroTopBarProps {
  onBack?: () => void;
  right?: ReactNode;
  title: string;
}

export function CarteiroTopBar({ onBack, right, title }: CarteiroTopBarProps) {
  return (
    <div className="flex h-14 items-center gap-3 bg-correios-blue px-4 text-white">
      {onBack ? (
        <button
          onClick={onBack}
          className="flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-white/10"
          type="button"
        >
          <svg fill="none" height="18" viewBox="0 0 24 24" width="18">
            <path
              d="M15 18L9 12L15 6"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.5"
            />
          </svg>
        </button>
      ) : (
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-correios-yellow text-[11px] font-black tracking-[0.2em] text-correios-blue">
          CE
        </div>
      )}

      <h1 className="flex-1 truncate text-center text-base font-semibold">{title}</h1>
      <div className="flex min-w-9 justify-end">{right ?? null}</div>
    </div>
  );
}
