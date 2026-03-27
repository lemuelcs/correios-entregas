import type { ReactNode } from 'react';

type BadgeVariant =
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral'
  | 'blue'
  | 'yellow';
type BadgeSize = 'sm' | 'md';

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  warning: 'bg-amber-50 text-amber-700 ring-amber-200',
  danger: 'bg-rose-50 text-rose-700 ring-rose-200',
  info: 'bg-sky-50 text-sky-700 ring-sky-200',
  neutral: 'bg-slate-100 text-slate-600 ring-slate-200',
  blue: 'bg-correios-blue-50 text-correios-blue ring-correios-blue/10',
  yellow: 'bg-correios-yellow-50 text-amber-800 ring-correios-yellow/30',
};

const DOT_CLASSES: Record<BadgeVariant, string> = {
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-rose-500',
  info: 'bg-sky-500',
  neutral: 'bg-slate-400',
  blue: 'bg-correios-blue',
  yellow: 'bg-correios-yellow-dark',
};

const SIZE_CLASSES: Record<BadgeSize, string> = {
  sm: 'px-2 py-1 text-[11px]',
  md: 'px-2.5 py-1 text-xs',
};

interface BadgeProps {
  children: ReactNode;
  dot?: boolean;
  size?: BadgeSize;
  variant?: BadgeVariant;
}

export function Badge({
  children,
  dot = false,
  size = 'md',
  variant = 'neutral',
}: BadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-full font-semibold ring-1 ring-inset',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
      ].join(' ')}
    >
      {dot ? <span className={['pulse-dot h-1.5 w-1.5 rounded-full', DOT_CLASSES[variant]].join(' ')} /> : null}
      {children}
    </span>
  );
}
