import type {
  ConvByKey,
  GodomallQuotes,
  GodomallSignups,
  InternalFilterConfig,
  MetricKey,
  MonthData,
  NamesMap,
  ShopTabKey,
  SiteId,
  ViewTab,
} from '../types/analytics';
import { k2v, lateStartDay, METRICS, okCmp, prevKey, suspOf, tracksEstimate } from '../utils/metrics';
import { DailyChart } from './BarChart';
import { Card } from './Card';
import { ConversionSection } from './ConversionSection';
import { MonthViewSkeleton } from './DashboardSkeleton';
import { InternalFilterNote } from './InternalFilterNote';
import { MonthKpiCards } from './MonthKpiCards';
import { Note } from './Note';
import { PopularPagesCard } from './PopularPagesCard';
import { SegmentedControl } from './SegmentedControl';
import { ShopCard } from './ShopCard';
import { Tag } from './Tag';
import { WhyCard } from './WhyCard';
import { SourceNotice, storeSource, type SourceLinkItem } from './SourceNotice';

const monthSources = (siteUrl: string): SourceLinkItem[] => [
  { label: 'Google Analytics 4 API', href: 'https://analytics.google.com/' },
  storeSource(siteUrl),
  { label: '방문자·세션·PV·체류시간 및 전환(견적·가입·주문) 집계' },
];

interface MonthViewProps {
  /** 보고 있는 사이트 (KPI 카드 링크 주소) */
  site: SiteId;
  /** 보고 있는 사이트의 쇼핑몰 주소 (출처 줄) */
  siteUrl: string;
  monthKey: string;
  months: Record<string, MonthData>;
  names: NamesMap;
  internal: InternalFilterConfig;
  godoSignups?: GodomallSignups | null;
  godoQuotes?: GodomallQuotes | null;
  godoQuotesLoading?: boolean;
  currentTab: 'overview' | 'conversion' | 'content';
  chartMetric: MetricKey;
  shopTab: ShopTabKey;
  convBy: ConvByKey;
  onChangeChartMetric: (m: MetricKey) => void;
  onChangeShopTab: (tab: ShopTabKey) => void;
  onChangeConvBy: (by: ConvByKey) => void;
  onOpenPage: (query: string) => void;
  /** KPI 카드를 누르면 열 화면 */
  onOpenTab: (tab: ViewTab) => void;
}

export function MonthView({
  site,
  siteUrl,
  monthKey,
  months,
  names,
  internal,
  godoSignups,
  godoQuotes,
  godoQuotesLoading,
  currentTab,
  chartMetric,
  shopTab,
  convBy,
  onChangeChartMetric,
  onChangeShopTab,
  onChangeConvBy,
  onOpenPage,
  onOpenTab,
}: MonthViewProps) {
  const m = months[monthKey];
  if (!m) {
    return <MonthViewSkeleton tab={currentTab} hasEstimate={tracksEstimate(Object.values(months))} />;
  }

  // 이 달이나 비교할 달의 GA4 수집이 중간에 시작됐으면 비교하지 않는다 (빈 날이 섞여 증감이 부풀려짐)
  const startDay = lateStartDay(months, monthKey);
  const prevK = prevKey(monthKey);
  const prevStartDay = lateStartDay(months, prevK);
  const prev = startDay ? undefined : okCmp(months, prevK);

  const series = m.daily.map((r) => k2v(r, m));
  const sp = suspOf(m);

  return (
    <>
      <InternalFilterNote internal={internal} monthKey={monthKey} />

      {(startDay > 0 || prevStartDay > 0) && (
        <Note className="flex-note">
          <Tag tone="warn">수집 시작</Tag>
          <span>
            {startDay > 0 ? (
              <>
                이 달은 GA4 수집이 <b>{+monthKey.slice(5)}월 {startDay}일부터</b>라 1~{startDay - 1}일 방문 기록이 없습니다. 전월·전년 비교는 하지 않습니다.
              </>
            ) : (
              <>
                전월({+prevK.slice(5)}월)은 GA4 수집이 <b>{prevStartDay}일부터</b>라 전월과는 비교하지 않습니다.
              </>
            )}
          </span>
        </Note>
      )}

      {/* 1. 종합 요약 (overview): KPI 요약 카드 + 일별 추이 차트 + 분석 각주 */}
      {currentTab === 'overview' && (
        <>
          <MonthKpiCards
            site={site}
            monthData={m}
            prevMonthData={prev}
            suspExcess={sp.excess}
            godoQuotes={godoQuotes}
            godoQuotesLoading={godoQuotesLoading}
            prevKey={prevK}
            onOpenTab={onOpenTab}
          />

          <Card
            className="card-daily-chart"
            id="sectionDailyChart"
            labelledBy="headingDailyChart"
          >
            <h2 id="headingDailyChart">
              <span>일별 추이</span>
              <SegmentedControl
                items={METRICS}
                value={chartMetric}
                onChange={onChangeChartMetric}
              />
            </h2>
            <DailyChart
              vals={series.map((r) => r[chartMetric])}
              dates={m.daily.map((r) => r.date)}
              unit={chartMetric === 'signups' ? '건' : ''}
            />
          </Card>

          <WhyCard />
        </>
      )}

      {/* 2. 전환 분석 (conversion): 견적/가입/주문 3대 전환 통합 분석 표 */}
      {currentTab === 'conversion' && (
        <ConversionSection
          monthData={m}
          prevMonthData={prev}
          prevKey={prevK}
          names={names}
          godoSignups={godoSignups}
          godoQuotes={godoQuotes}
          godoQuotesLoading={godoQuotesLoading}
          convBy={convBy}
          onChangeConvBy={onChangeConvBy}
          onOpenPage={onOpenPage}
        />
      )}

      {/* 3. 페이지 · 상품 (content): 인기 페이지 TOP 15 + 고도몰 상품/카테고리/게시판 */}
      {currentTab === 'content' && (
        <>
          <PopularPagesCard
            pages={m.pages}
            totalViews={m.total.screenPageViews}
            susp={sp}
            names={names}
            onOpenPage={onOpenPage}
          />

          <ShopCard
            monthData={m}
            names={names}
            shopTab={shopTab}
            onChangeShopTab={onChangeShopTab}
            onOpenPage={onOpenPage}
          />
        </>
      )}

      <SourceNotice sources={monthSources(siteUrl)} />
    </>
  );
}
