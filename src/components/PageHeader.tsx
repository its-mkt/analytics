import type { ReactNode } from 'react';

interface PageHeaderProps {
  id?: string;
  /** 화면 이름 — 사이드바 메뉴·헤더 경로와 같은 이름 (기간은 위쪽 기간 줄이 보여 준다) */
  title: string;
  /** 이 화면에서 무엇을 보는지 한 줄 설명 */
  desc?: string;
  /** 제목 오른쪽 상태 표시 (필요할 때만) */
  meta?: ReactNode;
}

/** 화면 머리말 — ad-insight 와 같은 구성: 왼쪽 강조 막대 + 화면 이름 + 한 줄 설명 */
export function PageHeader({ id, title, desc, meta }: PageHeaderProps) {
  return (
    <header className="page-header" id={id}>
      <div className="page-header-main">
        <h1 className="page-title">{title}</h1>
        {desc && <p className="page-desc">{desc}</p>}
      </div>
      {meta && <div className="page-header-meta">{meta}</div>}
    </header>
  );
}
