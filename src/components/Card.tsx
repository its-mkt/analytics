import type { ReactNode } from 'react';

interface CardProps {
  id?: string;
  /** `card` 뒤에 붙일 클래스 (예: 'card-shop mt') */
  className?: string;
  /** 카드 제목(h2)의 id — 화면 읽기 프로그램이 카드 이름으로 읽는다. 보통 CardHeader 의 id 와 같다 */
  labelledBy?: string;
  children: ReactNode;
}

/** 흰 카드 (`section.card`) — 화면의 카드 묶음은 모두 이 부품으로 감싼다. 제목 줄은 CardHeader */
export function Card({ id, className, labelledBy, children }: CardProps) {
  return (
    <section className={className ? `card ${className}` : 'card'} id={id} aria-labelledby={labelledBy}>
      {children}
    </section>
  );
}
