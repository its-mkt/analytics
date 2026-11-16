import { ArrowDown, ArrowUp, Minus } from 'lucide-react';

interface DeltaBadgeProps {
  cur: number | null | undefined;
  prev: number | null | undefined;
  label: string;
  /** 비교 값이 없을 때 보여 줄 문구 (없으면 아무것도 그리지 않는다) — 예: '전월 값 없음' */
  emptyText?: string;
}

/** 증감 방향 — 'up'·'down'·'flat', 비교할 수 없으면 null. 비교 값이 0 이고 이번 값이 있으면 'up'(신규) */
export function deltaDir(cur: number | null | undefined, prev: number | null | undefined): 'up' | 'down' | 'flat' | null {
  if (prev == null || cur == null) return null;
  if (prev === 0) return cur === 0 ? null : 'up';
  const p = ((cur - prev) / Math.abs(prev)) * 100;
  return Math.abs(p) < 0.05 ? 'flat' : p > 0 ? 'up' : 'down';
}

export function DeltaBadge({ cur, prev, label, emptyText }: DeltaBadgeProps) {
  const dir = deltaDir(cur, prev);
  if (dir == null || cur == null || prev == null) {
    return emptyText ? (
      <span className="delta flat">
        <Minus size={12} aria-hidden="true" /> <small>{emptyText}</small>
      </span>
    ) : null;
  }
  if (prev === 0) {
    return (
      <span className="delta up">
        신규 <small>{label}</small>
      </span>
    );
  }
  if (dir === 'flat') {
    return (
      <span className="delta flat">
        <Minus size={12} aria-hidden="true" /> <small>{label}</small>
      </span>
    );
  }
  const p = ((cur - prev) / Math.abs(prev)) * 100;
  return (
    <span className={`delta ${dir}`}>
      {dir === 'up' ? <ArrowUp size={12} aria-hidden="true" /> : <ArrowDown size={12} aria-hidden="true" />}{' '}
      {Math.abs(p).toFixed(1)}% <small>{label}</small>
    </span>
  );
}
