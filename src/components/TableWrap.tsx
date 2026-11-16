import type { CSSProperties, ReactNode } from 'react';
import { EmptyState } from './EmptyState';

interface TableWrapProps {
  /** true면 표 대신 빈 상태 문구를 보여 준다 */
  isEmpty?: boolean;
  empty?: ReactNode;
  emptyStyle?: CSSProperties;
  className?: string;
  children: ReactNode;
}

/** 가로 스크롤 표 래퍼 (`.tw`) + 빈 데이터 처리 */
export function TableWrap({
  isEmpty = false,
  empty,
  emptyStyle,
  className,
  children,
}: TableWrapProps) {
  return (
    <div className={className ? `table-wrap ${className}` : 'table-wrap'}>
      {isEmpty ? <EmptyState style={emptyStyle}>{empty}</EmptyState> : children}
    </div>
  );
}
