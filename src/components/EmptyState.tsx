import type { CSSProperties, ReactNode } from 'react';

interface EmptyStateProps {
  children?: ReactNode;
  style?: CSSProperties;
}

/** 데이터가 없을 때의 안내 문구 (`.empty`) */
export function EmptyState({ children = '데이터 없음', style }: EmptyStateProps) {
  return (
    <div className="empty" style={style}>
      {children}
    </div>
  );
}
