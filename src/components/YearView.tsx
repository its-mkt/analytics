import type {
  GodomallQuotes,
  GodomallSignups,
  MetricKey,
  MonthData,
} from '../types/analytics';
import { fmt } from '../utils/format';
import { metricOf, METRICS, okM, tracksEstimate } from '../utils/metrics';
import { MonthlyChart } from './BarChart';
import { Card } from './Card';
import { KpiCardsGrid, type KpiItem } from './KpiCardsGrid';
import { SegmentedControl } from './SegmentedControl';
import { YearSummaryTable } from './YearSummaryTable';
import { SourceNotice, storeSource, type SourceLinkItem } from './SourceNotice';

const yearSources = (siteUrl: string, godo: boolean): SourceLinkItem[] => [
  { label: 'Google Analytics 4 API', href: 'https://analytics.google.com/' },
  storeSource(siteUrl),
  { label: godo ? '연간 월별 누적 방문자·세션·페이지뷰 + 고도몰 실회원가입 집계' : '연간 월별 누적 방문자·세션·페이지뷰 집계' },
];

interface YearViewProps {
  /** 보고 있는 사이트의 쇼핑몰 주소 (출처 줄) */
  siteUrl: string;
  year: string;
  months: Record<string, MonthData>;
  godoSignups: GodomallSignups | null;
  godoQuotes?: GodomallQuotes | null;
  annMetric: MetricKey;
  onChangeAnnMetric: (m: MetricKey) => void;
  onSelectMonth: (monthKey: string) => void;
}

export function YearView({
  siteUrl,
  year,
  months,
  godoSignups,
  godoQuotes,
  annMetric,
  onChangeAnnMetric,
  onSelectMonth,
}: YearViewProps) {
  const ks = Array.from(
    { length: 12 },
    (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`,
  );
  const val = (k: string, key: MetricKey) =>
    months[k] ? metricOf(months[k], key) : 0;
  const vals = ks.map((k) => val(k, annMetric));
  const sum = (key: MetricKey) => ks.reduce((a, k) => a + val(k, key), 0);

  // 현재 연도에서 실제 데이터가 있는 월 목록 (측정 누락 제외)
  const validMonths = ks.filter((k) => okM(months, k));
  const isFullYear = validMonths.length === 12;
  const prevLabel = isFullYear ? '전년' : '전년 동기간';

  // 비교 대상 전년도 월 목록 (해당 월과 1:1 매칭)
  const py = Number(year) - 1;
  const pyMonths = validMonths.map((k) => `${py}-${k.slice(5)}`);
  const hasPyData =
    pyMonths.length > 0 && pyMonths.every((k) => okM(months, k));

  const psum = (key: MetricKey): number | null => {
    if (!hasPyData) return null;
    return pyMonths.reduce((a, k) => a + val(k, key), 0);
  };

  // 연간 KPI 4장 — 월 화면과 같은 규칙(ad-insight KpiCard): 이름에 기간, 단위, 비교 하나(전년 동기간), 아래 줄
  const period = `${year}년`;
  const name = (label: string) => `${period} ${label}${isFullYear ? '' : ' (누계)'}`;
  const hasGodoSign = ks.some((k) => godoSignups?.monthly?.[k] != null);
  const signOf = (list: string[]) =>
    list.reduce((a, k) => a + (godoSignups?.monthly?.[k] ?? (months[k] ? metricOf(months[k], 'signups') : 0)), 0);
  const signTotal = hasGodoSign ? signOf(ks) : sum('signups');
  const prevSignTotal = hasPyData ? (hasGodoSign ? signOf(pyMonths) : psum('signups')) : null;
  const quoteOf = (list: string[]) =>
    list.reduce((a, k) => {
      if (godoQuotes && godoQuotes.monthly[k] != null) return a + godoQuotes.monthly[k];
      return a + (okM(months, k)?.conv?.total?.estimate?.sessions || 0);
    }, 0);
  const visitors = sum('activeUsers');
  const views = sum('screenPageViews');
  const sessions = sum('sessions');
  const metric = (key: MetricKey) => ({ cur: sum(key), prev: psum(key), cmpLabel: prevLabel });

  const kpiItems: KpiItem[] = [
    // 1. 대표 전환 — 견적을 세는 사이트(아이티켓)는 견적 요청(아래 줄 회원가입), 아니면(온코어) 회원가입
    tracksEstimate(ks.map((k) => months[k]))
      ? {
          label: name('견적 요청'),
          value: quoteOf(ks),
          unit: '건',
          cur: quoteOf(ks),
          prev: hasPyData ? quoteOf(pyMonths) : null,
          cmpLabel: prevLabel,
          detail: [['회원가입', `${fmt(signTotal)}건`]],
          title: '고도몰 DB 견적 실접수 건수 기준',
        }
      : {
          label: name('회원가입'),
          value: signTotal,
          unit: '건',
          cur: signTotal,
          prev: prevSignTotal,
          cmpLabel: prevLabel,
          // 월 화면 온코어 카드와 같이 아래 줄에 주문(GA4 주문 완료 화면 세션)
          detail: [['주문', `${fmt(ks.reduce((n, k) => n + (okM(months, k)?.conv?.total?.order?.sessions || 0), 0))}건`]],
          title: hasGodoSign ? '고도몰 DB 실가입자 수 합산' : 'GA4 가입 완료 화면 기준',
        },
    {
      label: name('방문자'),
      value: visitors,
      unit: '명',
      ...metric('activeUsers'),
      detail: [['신규', `${fmt(sum('newUsers'))}명`]],
      title: `${year}년 일별 방문자 합산 (고도몰 통계와 같은 방식)`,
    },
    {
      label: name('세션'),
      value: sessions,
      unit: '회',
      ...metric('sessions'),
      detail: [['월평균', validMonths.length ? `${fmt(Math.round(sessions / validMonths.length))}회` : '―']],
    },
    {
      label: name('페이지뷰'),
      value: views,
      unit: '회',
      ...metric('screenPageViews'),
      detail: [['방문자당', visitors ? `${(views / visitors).toFixed(1)}회` : '―']],
    },
  ];

  return (
    <>
      <KpiCardsGrid
        id="kpisAnnual"
        ariaLabel="연간 누계 핵심 성과 지표"
        items={kpiItems}
      />

      <Card
        className="card-monthly-chart"
        id="sectionMonthlyChart"
        labelledBy="headingMonthlyChart"
      >
        <h2 id="headingMonthlyChart">
          <span>월별 추이</span>
          <SegmentedControl
            items={METRICS}
            value={annMetric}
            onChange={onChangeAnnMetric}
          />
        </h2>
        <MonthlyChart
          vals={vals}
          have={ks.map((k) => Boolean(okM(months, k)))}
          partial={ks.map((k) => Boolean(months[k] && months[k].partial))}
          unit={annMetric === 'signups' ? '건' : ''}
          sumOk
          onSelectMonthIndex={(idx) => {
            const target = ks[idx];
            if (okM(months, target)) {
              onSelectMonth(target);
            }
          }}
        />
      </Card>

      <YearSummaryTable
        year={year}
        ks={ks}
        months={months}
        godoSignups={godoSignups}
        godoQuotes={godoQuotes}
        onSelectMonth={onSelectMonth}
      />

      <SourceNotice sources={yearSources(siteUrl, !!godoSignups)} />
    </>
  );
}
