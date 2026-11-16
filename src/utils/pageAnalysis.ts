import type { NamesMap, PageAnalysisResult } from '../types/analytics';
import type { KpiItem } from '../components/KpiCardsGrid';
import { dur, fmt, pct } from './format';
import { prevKey } from './metrics';

/**
 * 쿼리(URL, 상품번호 등)로부터 화면 표시용 제목과 부제목을 도출합니다.
 */
export function resolvePageTitle(
  query: string,
  names?: NamesMap,
): { title: string; sub: string } {
  let title = query;
  let sub = '';

  const goodsMatch =
    query.match(/[?&]goodsNo=(\d+)/) || query.match(/^goodsNo=(\d+)/);

  if (goodsMatch && names?.goods?.[goodsMatch[1]]) {
    title = names.goods[goodsMatch[1]];
    sub = `상품번호 #${goodsMatch[1]} · ${query}`;
  } else if (query === '/' || query === '/main/index.php') {
    title = '홈 / 메인';
    sub = query;
  }

  return { title, sub };
}

/**
 * 페이지 분석 결과로부터 일별 날짜 목록과 조회수 배열을 생성합니다.
 */
export function buildPageDailySeries(
  result: PageAnalysisResult,
  targetMonth: string,
): { dates: string[]; views: number[] } {
  const days = result.partial
    ? +new Date()
        .toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
        .slice(8)
    : new Date(+targetMonth.slice(0, 4), +targetMonth.slice(5), 0).getDate();

  const dmap: Record<string, { date: string; screenPageViews: number }> = {};
  (result.daily || []).forEach((x) => {
    dmap[x.date] = x;
  });

  const dates = Array.from(
    { length: days },
    (_, i) => `${targetMonth}-${String(i + 1).padStart(2, '0')}`,
  );
  const views = dates.map((d) => (dmap[d] ? dmap[d].screenPageViews : 0));

  return { dates, views };
}

/**
 * 페이지 분석 상단 5대 핵심 KPI 아이템 배열을 생성합니다.
 */
/**
 * 페이지 분석 KPI 4장 — 월 화면과 같은 규칙(ad-insight KpiCard): 이름에 기간, 단위, 비교 하나(전월), 아래 줄.
 * 전월 비교는 페이지 월별 값(monthly)이 있는 조회수·방문자만 하고, 나머지는 '– 전월 값 없음'.
 */
export function buildPageKpis(result: PageAnalysisResult): KpiItem[] {
  const t = result.total || {};
  const views = t.screenPageViews || 0;
  const users = t.activeUsers || 0;
  const sessions = t.sessions || 0;
  const month = result.month || '';
  const name = (label: string) => (month ? `${+month.slice(5)}월 ` : '') + label + (result.partial ? ' (진행 중)' : '');
  const prevRow = month ? (result.monthly || []).find((r) => r.month === prevKey(month)) : undefined;
  const entry = result.entry || { sessions: 0, conv: {} as Record<string, number> };
  const entryConv = Object.values(entry.conv || {}).reduce((a, n) => a + n, 0);

  return [
    {
      label: name('조회수'),
      value: views,
      unit: '회',
      cur: views,
      prev: prevRow ? prevRow.screenPageViews : null,
      cmpLabel: '전월',
      detail: [['방문자당', users ? `${(views / users).toFixed(1)}회` : '―']],
    },
    {
      label: name('방문자'),
      value: users,
      unit: '명',
      cur: users,
      prev: prevRow ? prevRow.activeUsers : null,
      cmpLabel: '전월',
      detail: [['세션', `${fmt(sessions)}회`]],
    },
    {
      label: name('처음 들어온 방문'),
      value: entry.sessions,
      unit: '회',
      // 전월 값을 받지 않는 지표 — 카드 줄을 맞추려고 규칙대로 '– 전월 값 없음'
      cur: entry.sessions,
      prev: null,
      cmpLabel: '전월',
      detail: [
        ['전환', `${fmt(entryConv)}건`],
        ['전환율', pct(entryConv, entry.sessions)],
      ],
      title: '이 페이지로 처음 들어온(랜딩) 세션과 그중 전환 완료 화면까지 간 세션',
    },
    {
      label: name('방문자당 체류'),
      value: dur(users ? (t.userEngagementDuration || 0) / users : 0),
      prev: null,
      cmpLabel: '전월',
      detail: [['세션당', dur(sessions ? (t.userEngagementDuration || 0) / sessions : 0)]],
    },
  ];
}
