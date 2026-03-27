type ProgressSize = 'sm' | 'md' | 'lg';
type ProgressTone = 'blue' | 'green' | 'amber' | 'red';

const HEIGHT_CLASSES: Record<ProgressSize, string> = {
  sm: 'h-1.5',
  md: 'h-2.5',
  lg: 'h-3.5',
};

const FILL_CLASSES: Record<ProgressTone, string> = {
  blue: 'bg-correios-blue',
  green: 'bg-emerald-500',
  amber: 'bg-amber-500',
  red: 'bg-rose-500',
};

interface ProgressBarProps {
  label?: string;
  showPercentage?: boolean;
  size?: ProgressSize;
  tone?: ProgressTone;
  value: number;
}

export function ProgressBar({
  label,
  showPercentage = false,
  size = 'md',
  tone = 'blue',
  value,
}: ProgressBarProps) {
  const percentage = Math.min(100, Math.max(0, value));

  return (
    <div className="w-full">
      {label || showPercentage ? (
        <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
          {label ? <span className="font-medium text-slate-600">{label}</span> : <span />}
          {showPercentage ? <span className="font-semibold text-slate-700">{percentage}%</span> : null}
        </div>
      ) : null}

      <div className={['w-full overflow-hidden rounded-full bg-slate-100', HEIGHT_CLASSES[size]].join(' ')}>
        <div
          className={['h-full rounded-full transition-all duration-500', FILL_CLASSES[tone]].join(' ')}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
