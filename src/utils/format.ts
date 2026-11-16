export const fmt = (n: number | null | undefined): string =>
  n == null || isNaN(n) ? '―' : Math.round(n).toLocaleString('ko-KR');

export const dur = (s: number | null | undefined): string => {
  if (!s || isNaN(s)) return '―';
  const sec = Math.round(s);
  return sec >= 60
    ? `${Math.floor(sec / 60)}분 ${String(sec % 60).padStart(2, '0')}초`
    : `${sec}초`;
};

export const axisC = (v: number): string =>
  v >= 1000 ? `${+(v / 1000).toFixed(1)}k` : String(Math.round(v));

export const fmtC = (v: number): string =>
  v >= 10000 ? `${+(v / 10000).toFixed(1)}만` : fmt(v);

export const pct = (a: number, b: number): string =>
  b > 0 ? `${((a / b) * 100).toFixed(1)}%` : '―';

/** 'YYYY-MM' → 'YYYY년 M월' */
export const monthLabel = (k: string): string =>
  `${k.slice(0, 4)}년 ${+k.slice(5, 7)}월`;

/** 'YYYY' → 'YYYY년 연간', 'YYYY-MM' → 'YYYY년 M월' */
export const periodLabel = (k: string): string =>
  k.length === 4 ? `${k}년 연간` : monthLabel(k);

export const agoText = (sec: number): string =>
  sec < 5 ? '방금' : sec < 90 ? `${sec}초 전` : `${Math.round(sec / 60)}분 전`;

export interface OdometerDigit {
  same: boolean;
  oldChar: string;
  newChar: string;
  dir: 'roll-up' | 'roll-down';
  gone: boolean;
}

export function computeOdometer(fromVal: number, toVal: number): OdometerDigit[] {
  const x = [...fmt(fromVal)].reverse();
  const y = [...fmt(toVal)].reverse();
  const dir: 'roll-up' | 'roll-down' = toVal > fromVal ? 'roll-up' : 'roll-down';
  const out: OdometerDigit[] = [];
  const maxLen = Math.max(x.length, y.length);
  for (let i = 0; i < maxLen; i++) {
    const o = x[i] ?? '';
    const n = y[i] ?? '';
    out.unshift({
      same: o === n,
      oldChar: o,
      newChar: n,
      dir,
      gone: n === '',
    });
  }
  return out;
}
