import type { GodomallQuotes, MonthData, SiteId, ViewTab } from '../types/analytics';
import { dur, fmt, pct } from '../utils/format';
import { godoCount, metricOf, tracksEstimate } from '../utils/metrics';
import { routePath } from '../utils/route';
import { VIEW_TITLES } from '../utils/views';
import { KpiCardsGrid, type KpiItem } from './KpiCardsGrid';

interface MonthKpiCardsProps {
  site: SiteId;
  monthData: MonthData;
  /** 비교할 전월 (수집 공백·중간 시작 달이면 null — 그때는 '전월 값 없음') */
  prevMonthData?: MonthData | null;
  suspExcess: number;
  godoQuotes?: GodomallQuotes | null;
  godoQuotesLoading?: boolean;
  /** 견적 실건수(고도몰 DB)를 비교할 전월 — GA4 비교가 빠진 달이어도 실건수는 비교한다 */
  prevKey?: string;
  /** 카드를 누르면 열 화면 */
  onOpenTab: (tab: ViewTab) => void;
}

/**
 * 월 화면 KPI 4장 — ad-insight 와 같은 규칙 (사용자 결정 2026-11-16).
 *   첫 칸 대표 전환(아이티켓 견적 요청 · 온코어 회원가입) · 방문자 · 세션 · 페이지뷰.
 *   신규 방문자는 방문자 카드, 체류시간은 세션 카드의 아래 줄로. 증감은 전월 한 달 전체와 하나만.
 */
export function MonthKpiCards({
  site,
  monthData: m,
  prevMonthData: prev,
  suspExcess,
  godoQuotes,
  godoQuotesLoading,
  prevKey: prevK,
  onOpenTab,
}: MonthKpiCardsProps) {
  const partialDays = m.partial ? m.daily.length : null;
  const name = (label: string) => `${+m.month.slice(5)}월 ${label}${m.partial ? ' (진행 중)' : ''}`;
  const link = (tab: ViewTab) => ({
    href: routePath({ site, tab, q: '', m: m.month }),
    title: `${VIEW_TITLES[tab]}에서 자세히 보기`,
    onOpen: () => onOpenTab(tab),
  });

  // 방문자당 체류시간 — 진행 중인 달은 일별 합산 기준 (전월 비교 없이 아래 줄 값으로만 쓴다)
  const daySum = (k: 'userEngagementDuration' | 'activeUsers') => m.daily.reduce((a, r) => a + (r[k] || 0), 0);
  const curDur = partialDays
    ? (daySum('activeUsers') ? daySum('userEngagementDuration') / daySum('activeUsers') : 0)
    : (m.total.activeUsers ? m.total.userEngagementDuration / m.total.activeUsers : 0);

  const visitors = metricOf(m, 'activeUsers');
  const sessions = metricOf(m, 'sessions');
  const views = metricOf(m, 'screenPageViews');

  // 기기 비중 (세션 기준) — PC·모바일
  const devSessions = (m.devices || []).reduce((a, d) => a + d.sessions, 0);
  const devShare = (cat: string) => pct((m.devices || []).find((d) => d.deviceCategory === cat)?.sessions || 0, devSessions);

  const items: KpiItem[] = [];

  // 1. 대표 전환 — 견적을 세는 사이트(아이티켓)는 견적 요청, 아니면(온코어) 회원가입
  if (tracksEstimate([m])) {
    const godoEst = godoCount(godoQuotes, m.month, partialDays);
    const ga4Est = m.conv?.total?.estimate?.sessions || 0;
    const estPrev =
      godoEst != null
        ? godoCount(godoQuotes, prevK ?? prev?.month, null)
        : prev?.conv ? prev.conv.total.estimate?.sessions || 0 : null;
    const cats = godoQuotes?.byCategory?.[m.month];
    const catItems: Array<[string, number]> = cats
      ? Object.entries(cats).sort((a, b) => b[1] - a[1]).slice(0, 3)
      : [];
    items.push({
      label: name('견적 요청'),
      value: godoEst ?? ga4Est,
      unit: '건',
      loading: !!godoQuotesLoading,
      cur: godoEst ?? ga4Est,
      prev: estPrev,
      cmpLabel: '전월',
      // 견적문의 시트 연동이 실패하면 GA4 완료화면 세션을 대신 보여 주고 아래 줄에 기준을 적는다
      detail: godoEst != null ? catItems : [['기준', 'GA4 완료화면']],
      title: godoEst != null ? `견적문의 시트 실접수 기준 (GA4 완료화면 세션 ${fmt(ga4Est)}건)` : '시트 연동 실패 — GA4 견적 완료화면 세션 기준',
      link: link('conversion'),
    });
  } else {
    const signup = m.conv?.total?.signup?.sessions || 0;
    items.push({
      label: name('회원가입'),
      value: signup,
      unit: '건',
      cur: signup,
      prev: prev?.conv ? prev.conv.total.signup?.sessions || 0 : null,
      cmpLabel: '전월',
      detail: [['주문', `${fmt(m.conv?.total?.order?.sessions || 0)}건`]],
      title: 'GA4 가입 완료 화면을 본 세션 기준',
      link: link('conversion'),
    });
  }

  // 2. 방문자 — 아래 줄: 신규 · 기기 비중
  items.push({
    label: name('방문자'),
    value: visitors,
    unit: '명',
    cur: visitors,
    prev: prev ? metricOf(prev, 'activeUsers') : null,
    cmpLabel: '전월',
    detail: [
      ['신규', `${fmt(metricOf(m, 'newUsers'))}명`],
      ...(devSessions ? ([['PC', devShare('desktop')], ['모바일', devShare('mobile')]] as Array<[string, string]>) : []),
    ],
    title: `일별 방문자 합산 (고도몰 통계와 같은 방식) · 월 순 방문자 ${fmt(m.total.activeUsers)}명`,
    link: link('conversion'),
  });

  // 3. 세션 — 아래 줄: 참여율 · 방문자당 체류시간
  items.push({
    label: name('세션'),
    value: sessions,
    unit: '회',
    cur: sessions,
    prev: prev ? metricOf(prev, 'sessions') : null,
    cmpLabel: '전월',
    detail: [
      ['참여율', pct(m.total.engagedSessions || 0, m.total.sessions)],
      ['방문자당 체류', dur(curDur)],
    ],
    link: link('conversion'),
  });

  // 4. 페이지뷰 — 아래 줄: 방문자당 조회
  items.push({
    label: name('페이지뷰'),
    value: views,
    unit: '회',
    cur: views,
    prev: prev ? metricOf(prev, 'screenPageViews') : null,
    cmpLabel: '전월',
    detail: [['방문자당', visitors ? `${(views / visitors).toFixed(1)}회` : '―']],
    title: suspExcess > 0 ? `새로고침 추정분 약 ${fmt(suspExcess)}뷰 제외 시 ≈ ${fmt(views - suspExcess)}뷰` : undefined,
    link: link('content'),
  });

  return <KpiCardsGrid items={items} id="kpisMonth" ariaLabel="월간 핵심 성과 지표" />;
}
