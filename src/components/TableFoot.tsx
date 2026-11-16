import type { ReactNode } from 'react';

interface TableFootProps {
  /** 왼쪽 설명 */
  children: ReactNode;
  /** 오른쪽 단위 표기 (예: "단위: 회·명") */
  unit: ReactNode;
}

/** 표 하단 설명·단위 바 (`.tbl-foot`) */
export function TableFoot({ children, unit }: TableFootProps) {
  return (
    <div className="tbl-foot">
      <div className="foot-left">{children}</div>
      <div className="foot-right">{unit}</div>
    </div>
  );
}
