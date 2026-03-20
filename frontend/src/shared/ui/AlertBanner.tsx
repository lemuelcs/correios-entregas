import type { ReactNode } from 'react';

type AlertVariant = 'info' | 'success' | 'warning' | 'danger';

const ALERT_CLASSES: Record<AlertVariant, string> = {
  info: 'border-sky-200 bg-sky-50 text-sky-900',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  danger: 'border-rose-200 bg-rose-50 text-rose-900',
};

const ALERT_MARKERS: Record<AlertVariant, string> = {
  info: 'IN',
  success: 'OK',
  warning: 'AT',
  danger: 'CR',
};

interface AlertBannerProps {
  children: ReactNode;
  title: string;
  variant?: AlertVariant;
}

export function AlertBanner({ children, title, variant = 'info' }: AlertBannerProps) {
  return (
    <div className={['rounded-2xl border p-4 shadow-sm', ALERT_CLASSES[variant]].join(' ')}>
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/80 text-xs font-black tracking-[0.18em]">
          {ALERT_MARKERS[variant]}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold">{title}</p>
          <div className="mt-1 text-sm leading-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
