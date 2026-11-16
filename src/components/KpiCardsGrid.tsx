import type { ReactNode } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { fmt } from '../utils/format';
import { DeltaBadge, deltaDir } from './DeltaBadge';
import { Skeleton } from './Skeleton';

/**
 * KPI 카드 한 장 — ad-insight KpiCard 와 같은 읽는 법 (사용자 결정 2026-11-16):
 *   이름(기간 포함) → 큰 값(단위) → 증감 한 줄(비교 하나) → 아래 줄 "이름 값 | 이름 값" → 누르면 관련 화면.
 *   카드 바탕은 증감 방향만 따라 옅게 물든다 (올라감 빨강 · 내려감 파랑 — 지표의 좋고 나쁨과 무관).
 * 모양(모서리·높이·글자)은 analytics 디자인 규칙을 따른다.
 */
export interface KpiItem {
  /** 카드 이름 — 기간을 넣는다 (예: '11월 방문자 (진행 중)') */
  label: string;
  value: string | number;
  /** 큰 값 뒤에 붙는 단위 (명·회·건) */
  unit?: string;
  loading?: boolean;
  /** 증감 — 이번 값·비교 값·비교 이름. cmpLabel 이 있으면 비교 값이 없어도 '– 전월 값 없음' 을 보여 준다 */
  cur?: number | null;
  prev?: number | null;
  cmpLabel?: string;
  /** 아래 보조 줄 — [이름, 값] 목록 */
  detail?: Array<[string, string | number]>;
  /** 카드에 마우스를 올리면 보이는 설명 */
  title?: string;
  /** 누르면 이동 — 카드 전체가 링크가 되고 이름 오른쪽에 ↗ */
  link?: { href: string; title: string; onOpen: () => void };
  /** 예전 방식(페이지 분석): 증감·아래 줄을 직접 넘긴다 */
  badge?: ReactNode;
  sub?: ReactNode;
}

export interface KpiCardsGridProps {
  items: KpiItem[];
  id?: string;
  className?: string;
  ariaLabel?: string;
}

function KpiBody({ item }: { item: KpiItem }) {
  return (
    <>
      <div className="kpi-head">
        <span className="label kpi-label">{item.label}</span>
        {item.link && <ArrowUpRight className="kpi-link-ico" size={16} aria-hidden="true" />}
      </div>
      <div className="value kpi-value">
        {item.loading ? (
          <Skeleton className="kpi-skel-val" />
        ) : (
          <>
            {typeof item.value === 'number' ? fmt(item.value) : item.value}
            {item.unit && <span className="value-unit">{item.unit}</span>}
          </>
        )}
      </div>
      {item.loading ? (
        <Skeleton className="kpi-skel-sub" />
      ) : item.cmpLabel ? (
        <DeltaBadge cur={item.cur} prev={item.prev} label={item.cmpLabel} emptyText={`${item.cmpLabel} 값 없음`} />
      ) : (
        item.badge
      )}
      {!item.loading && item.detail && item.detail.length > 0 && (
        <div className="kpi-detail">
          {item.detail.map(([name, v], i) => (
            <span key={name} className="kpi-detail-item">
              {i > 0 && <i aria-hidden="true">|</i>}
              {name} <b>{typeof v === 'number' ? fmt(v) : v}</b>
            </span>
          ))}
        </div>
      )}
      {!item.loading && item.sub}
    </>
  );
}

export function KpiCardsGrid({ items, id, className = '', ariaLabel = '주요 지표' }: KpiCardsGridProps) {
  return (
    <section id={id} className={`kpis ${className}`.trim()} aria-label={ariaLabel}>
      {items.map((item, idx) => {
        const dir = !item.loading && item.cmpLabel ? deltaDir(item.cur, item.prev) : null;
        const tone = dir === 'up' || dir === 'down' ? ` ${dir}` : '';
        if (!item.link) {
          return (
            <article key={item.label || idx} className={`kpi${tone}`} title={item.title}>
              <KpiBody item={item} />
            </article>
          );
        }
        const { href, title, onOpen } = item.link;
        return (
          <a
            key={item.label || idx}
            className={`kpi kpi-link${tone}`}
            href={href}
            title={item.title ? `${item.title}\n${title}` : title}
            onClick={(e) => {
              // 새 탭·창으로 여는 경우는 브라우저에 맡기고, 그냥 누르면 새로고침 없이 이동한다
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) return;
              e.preventDefault();
              onOpen();
            }}
          >
            <KpiBody item={item} />
          </a>
        );
      })}
    </section>
  );
}
