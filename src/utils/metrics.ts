import type {
  ConvByKey,
  DailyMetric,
  DailyMetricWithSignups,
  GodomallSignups,
  MetricKey,
  MonthData,
  NamesMap,
  PageRow,
  ShopItem,
  ShopTabKey,
} from '../types/analytics';

export const METRICS: Array<[MetricKey, string]> = [
  ['activeUsers', '방문자'],
  ['sessions', '세션'],
  ['screenPageViews', '페이지뷰'],
  ['newUsers', '신규 방문자'],
  ['signups', '회원가입'],
];

export const CONV_BY: Array<[ConvByKey, string]> = [
  ['byMedium', '유입 매체'],
  ['byChannel', '채널'],
  ['byCampaign', '캠페인'],
  ['byLanding', '랜딩 페이지'],
  ['byGoods', '상품'],
];

export const SUSP_MIN_PV = 500;
export const SUSP_RATIO = 10;
export const NORMAL_RATIO = 2;

export const signups = (m: MonthData): number =>
  (m.signups || []).reduce((a, r) => a + r.count, 0);

// 방문자는 고도몰 통계와 같은 방식(일별 방문자의 합)으로 센다. GA4의 월 중복 제거 값은 m.total.activeUsers(순 방문자).
export const dailySum = (m: MonthData, k: Exclude<MetricKey, 'signups'>): number =>
  m.daily.reduce((a, r) => a + (r[k] || 0), 0);

export const metricOf = (m: MonthData, k: MetricKey): number =>
  k === 'signups'
    ? signups(m)
    : k === 'activeUsers'
      ? dailySum(m, 'activeUsers')
      : m.total[k];

export const suspOf = (m: MonthData): { list: PageRow[]; excess: number } => {
  const list = (m.pages || []).filter(
    (p) =>
      p.screenPageViews > SUSP_MIN_PV &&
      p.screenPageViews / Math.max(1, p.activeUsers) > SUSP_RATIO,
  );
  const excess = list.reduce(
    (a, p) => a + p.screenPageViews - p.activeUsers * NORMAL_RATIO,
    0,
  );
  return { list, excess };
};

export const prevKey = (k: string): string => {
  const [y, mo] = k.split('-').map(Number);
  return mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, '0')}`;
};

export const yoyKey = (k: string): string =>
  `${+k.slice(0, 4) - 1}-${k.slice(5)}`;

// 방문 기록이 사실상 없는 달(세션 100 미만, 진행 중인 달 제외) — 비교·합산에서 제외한다
export const isGap = (m?: MonthData): boolean =>
  !!m && !m.partial && m.total.sessions < 100;

export const okM = (
  months: Record<string, MonthData>,
  k: string,
): MonthData | undefined => {
  const m = months[k];
  return m && !isGap(m) ? m : undefined;
};

/**
 * GA4 수집이 그 달 중간에 시작된 달이면 시작일(일), 아니면 0.
 * 앞 달이 없거나 미집계인데 첫 기록이 2일 이후인 달 — 아이티켓 2026-07(9일 재설치), 온코어 2026-10(13일 설치).
 * 1일~시작 전날이 비어 있어 전월·전년 비교에 쓰면 증감이 크게 부풀려진다.
 */
export const lateStartDay = (months: Record<string, MonthData>, k: string): number => {
  const m = months[k];
  if (!m || isGap(m) || !m.daily.length) return 0;
  const first = Math.min(...m.daily.map((r) => +r.date.slice(8)));
  if (first <= 1) return 0;
  const p = months[prevKey(k)];
  return !p || isGap(p) ? first : 0;
};

/**
 * 회원가입 실건수 = 회원 DB(es_member) 값. 단 DB 는 1년 넘게 접속하지 않은 회원이 휴면 보관소로 옮겨지며 빠져서
 * 오래된 달일수록 줄어든다(2025-09: DB 1 ↔ 관리자 통계 19). 가입 시점에 남은 고도몰 관리자 통계(admin)가 더 크면 그 값을 쓴다.
 * 일별(daily)은 DB 값 그대로 — 진행 중인 달 1~n일 합산에만 쓰고, 최근 달은 두 값이 같다.
 */
export function mergeSignups(
  db: GodomallSignups | null | undefined,
  admin: GodomallSignups | null | undefined,
): GodomallSignups | null {
  if (!admin?.monthly) return db ?? null;
  if (!db?.monthly) return { monthly: { ...admin.monthly } };
  const monthly = { ...db.monthly };
  for (const [m, v] of Object.entries(admin.monthly)) if (v > (monthly[m] ?? 0)) monthly[m] = v;
  return { ...db, monthly };
}

/** 비교 기준으로 쓸 수 있는 달 — 미집계 달과 수집이 중간에 시작된 달은 뺀다 */
export const okCmp = (months: Record<string, MonthData>, k: string): MonthData | undefined =>
  lateStartDay(months, k) ? undefined : okM(months, k);

export const k2v = (r: DailyMetric, m: MonthData): DailyMetricWithSignups => {
  const s = (m.signups || []).find((x) => x.date === r.date);
  return { ...r, signups: s ? s.count : 0 };
};

/** 시트 실집계(월별·일별) 건수. n 이 있으면 그 달 1~n일만 합산(진행 중인 달의 현재 값). 데이터 없으면 null. */
export function godoCount(
  src: { monthly: Record<string, number>; daily?: Record<string, number> } | null | undefined,
  month: string | undefined,
  n: number | null,
): number | null {
  if (!src || !month) return null;
  if (!n) return src.monthly[month] ?? null;
  if (!src.daily) return null;
  let sum = 0;
  for (const [d, c] of Object.entries(src.daily)) {
    if (d.slice(0, 7) === month && +d.slice(8) <= n) sum += c;
  }
  return sum;
}

const GENERIC_TITLE = /^아이티켓 - /;

export const shopItemName = (
  names: NamesMap | undefined,
  shopTab: ShopTabKey,
  r: ShopItem,
): string =>
  (names && names[shopTab] && names[shopTab]?.[r.id]) ||
  (r.title && !GENERIC_TITLE.test(r.title) ? r.title : `#${r.id} (이름 확인 중)`);

/**
 * 견적 전환을 세는 데이터인지. 온코어는 견적 완료 화면이 없어 수집기의 전환 정의(conv.defs)에 estimate 가 없다.
 * 전환 정의가 없는 예전 달은 센다고 본다 (아이티켓 예전 데이터).
 */
export const tracksEstimate = (list: Array<MonthData | null | undefined>): boolean =>
  !list.some((m) => m?.conv?.defs && !m.conv.defs.some((d) => d.id === 'estimate'));
