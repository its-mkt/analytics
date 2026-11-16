import type { ReactNode } from 'react';

interface TagProps {
  tone?: 'default' | 'warn' | 'ok';
  children: ReactNode;
}

/** 상태 표시용 작은 뱃지 (`.tag`) */
export function Tag({ tone = 'default', children }: TagProps) {
  return (
    <span className={tone === 'default' ? 'tag' : `tag ${tone}`}>
      {children}
    </span>
  );
}
