import type { PageAnalysisResult as PageAnalysisData } from '../types/analytics';
import { SUSP_MIN_PV, SUSP_RATIO } from '../utils/metrics';
import { buildPageDailySeries, buildPageKpis } from '../utils/pageAnalysis';
import { DailyChart } from './BarChart';
import { Card } from './Card';
import { CardHeader } from './CardHeader';
import { EmptyState } from './EmptyState';
import { KpiCardsGrid } from './KpiCardsGrid';
import { Note } from './Note';
import { PageAnalysisDetails } from './PageAnalysisDetails';

interface PageAnalysisResultProps {
  result: PageAnalysisData;
  query: string;
  /** 결과에 month가 없을 때 쓸 월 */
  fallbackMonth: string;
  /** page: URL 분석 화면, drawer: 슬라이드오버 서랍 */
  variant: 'page' | 'drawer';
  onOpenPage: (query: string, month?: string) => void;
}

/** 페이지 분석 결과 본문 (KPI + 일별 조회수 + 상세 표) — URL 분석 화면·서랍 공용 */
export function PageAnalysisResult({
  result: r,
  query,
  fallbackMonth,
  variant,
  onOpenPage,
}: PageAnalysisResultProps) {
  const isDrawer = variant === 'drawer';
  const t = r.total || {};
  const views = t.screenPageViews || 0;
  const rMonth = r.month || fallbackMonth;
  const q = r.q || query;

  if (!views) {
    return (
      <div className="card">
        <EmptyState>
          {isDrawer
            ? `“${q}”의 ${rMonth} 조회 기록이 없습니다.`
            : `“${q}” 이(가) 포함된 페이지의 ${rMonth} 조회 기록이 없습니다.`}
          <br />
          주소 일부나 상품번호를 확인해 보세요.
        </EmptyState>
      </div>
    );
  }

  const { dates, views: sv } = buildPageDailySeries(r, rMonth);
  const ratio = t.activeUsers ? views / t.activeUsers : 0;
  const kpiItems = buildPageKpis(r);

  const ago = r.at
    ? Math.max(0, Math.round((Date.now() - new Date(r.at).getTime()) / 60000))
    : 0;
  const fetchedSub = (
    <>
      {rMonth}
      {r.partial ? ' (진행 중)' : ''} ·{' '}
      {ago < 1 ? '방금' : `${ago}분 전`} 조회
    </>
  );

  const body = (
    <>
      {ratio > SUSP_RATIO && views > SUSP_MIN_PV && (
        <Note warning>
          방문자 1명당 조회수가 {ratio.toFixed(1)}배입니다. 내부 새로고침·자동 접속일 수 있습니다
          {isDrawer ? '.' : '(회사 IP 제외 설정 전 데이터에는 직원 접속이 섞여 있습니다).'}
        </Note>
      )}
      {!isDrawer && (r.errors || []).length > 0 && (
        <Note>일부 항목을 가져오지 못했습니다: {(r.errors || []).join(' / ')}</Note>
      )}

      <KpiCardsGrid
        id={isDrawer ? 'kpisPageDrawer' : 'kpisPageAnalysis'}
        ariaLabel="페이지 분석 핵심 지표"
        items={kpiItems}
      />

      {isDrawer ? (
        <Card
          className="card-page-daily-views"
          id="sectionDrawerDailyViews"
        >
          <CardHeader title="일별 조회수" sub={fetchedSub} />
          <DailyChart vals={sv} dates={dates} unit="" />
        </Card>
      ) : (
        <Card
          className="card-page-daily-views"
          id="sectionPageDailyViews"
          labelledBy="headingPageDailyViews"
        >
          <h2 id="headingPageDailyViews">
            <span>
              일별 조회수 — “{q}”{' '}
              <span className="sub-title">{fetchedSub}</span>
            </span>
          </h2>
          <DailyChart vals={sv} dates={dates} unit="" />
        </Card>
      )}

      <PageAnalysisDetails
        result={r}
        currentMonth={rMonth}
        query={query}
        onOpenPage={onOpenPage}
      />
    </>
  );

  return isDrawer ? <div className="drawer-body-inner">{body}</div> : body;
}
