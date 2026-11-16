import type { ReactNode } from 'react';

interface CardHeaderProps {
  /** h2 id (카드 section의 aria-labelledby 대상) */
  id?: string;
  title: ReactNode;
  sub?: ReactNode;
  /** 오른쪽 영역 (세그먼트 컨트롤 등) */
  actions?: ReactNode;
}

/** 표 카드 상단 제목 바 (`.card-head-bar`) */
export function CardHeader({ id, title, sub, actions }: CardHeaderProps) {
  return (
    <div className="card-head-bar">
      <h2 id={id}>
        {sub != null ? (
          <>
            <span>{title}</span>
            <span className="sub-title">{sub}</span>
          </>
        ) : (
          title
        )}
      </h2>
      {actions}
    </div>
  );
}
