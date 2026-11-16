import { ArrowDown, ArrowUp, Minus } from 'lucide-react';

interface DeltaBadgeProps {
  cur: number | null | undefined;
  prev: number | null | undefined;
  label: string;
}

export function DeltaBadge({ cur, prev, label }: DeltaBadgeProps) {
  if (prev == null || cur == null) return null;
  if (prev === 0) {
    if (cur === 0) return null;
    return (
      <span className="delta up">
        신규 <small>{label}</small>
      </span>
    );
  }
  const p = ((cur - prev) / Math.abs(prev)) * 100;
  if (Math.abs(p) < 0.05) {
    return (
      <span className="delta flat">
        <Minus size={12} aria-hidden="true" /> <small>{label}</small>
      </span>
    );
  }
  return (
    <span className={`delta ${p > 0 ? 'up' : 'down'}`}>
      {p > 0 ? <ArrowUp size={12} aria-hidden="true" /> : <ArrowDown size={12} aria-hidden="true" />}{' '}
      {Math.abs(p).toFixed(1)}% <small>{label}</small>
    </span>
  );
}
