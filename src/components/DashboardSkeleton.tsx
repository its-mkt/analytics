import type { ViewTab } from '../types/analytics';
import { SkeletonChartCard, SkeletonKpiCards, SkeletonTableCard } from './Skeleton';

interface MonthViewSkeletonProps {
  /** 그릴 화면 — 화면마다 실제 카드 구성과 같은 모양으로 그려 로딩이 끝날 때 화면이 들썩이지 않게 한다 */
  tab: Exclude<ViewTab, 'page'>;
  /** 이 사이트가 견적 전환을 세는지 (아이티켓 O · 온코어 X) — KPI 카드 수가 달라진다 */
  hasEstimate: boolean;
}

/**
 * 월 화면 로딩 모양. 화면 머리말은 App 이 항상 그리므로 여기서는 본문만.
 * 종합 요약: KPI 4장 + 일별 추이 + 분석 각주 / 전환 분석: 전환 KPI 3장(온코어 2) + 전환 표 / 페이지·상품: 인기 페이지 표 + 고도몰 표
 */
export function MonthViewSkeleton({ tab, hasEstimate }: MonthViewSkeletonProps) {
  return (
    <div className="dashboard-skel" aria-busy="true" aria-label="월별 데이터 로딩 중">
      {tab === 'overview' && (
        <>
          <SkeletonKpiCards count={4} />
          <SkeletonChartCard barCount={30} />
          <SkeletonTableCard rowCount={4} />
        </>
      )}
      {tab === 'conversion' && (
        <>
          <SkeletonKpiCards count={hasEstimate ? 3 : 2} />
          <SkeletonTableCard rowCount={8} />
        </>
      )}
      {tab === 'content' && (
        <>
          <SkeletonTableCard rowCount={10} />
          <SkeletonTableCard rowCount={8} />
        </>
      )}
    </div>
  );
}
