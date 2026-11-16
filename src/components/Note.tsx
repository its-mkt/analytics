import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface NoteProps {
  /** 앞에 경고 아이콘 표시 */
  warning?: boolean;
  className?: string;
  children: ReactNode;
}

/** 노란 안내 박스 (`.note`) */
export function Note({ warning = false, className, children }: NoteProps) {
  return (
    <div className={className ? `note ${className}` : 'note'}>
      {warning && (
        <>
          <AlertTriangle size={14} aria-hidden="true" />{' '}
        </>
      )}
      {children}
    </div>
  );
}
