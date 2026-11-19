export type MetricKey = 'activeUsers' | 'sessions' | 'screenPageViews' | 'newUsers' | 'signups';
export type ShopTabKey = 'goods' | 'categories' | 'boards';
export type ConvByKey = 'byMedium' | 'byChannel' | 'byCampaign' | 'byLanding' | 'byGoods';
export type ViewTab = 'overview' | 'conversion' | 'content' | 'page';

export interface TotalMetrics {
  activeUsers: number;
  newUsers: number;
  sessions: number;
  screenPageViews: number;
  userEngagementDuration: number;
  engagedSessions: number;
}

export interface DailyMetric extends TotalMetrics {
  date: string;
}

export interface DailyMetricWithSignups extends DailyMetric {
  signups: number;
}

export interface PageRow {
  pagePath: string;
  screenPageViews: number;
  activeUsers: number;
  userEngagementDuration: number;
}

export interface SourceRow {
  sessionSourceMedium: string;
  sessions: number;
  activeUsers: number;
  newUsers?: number;
  engagedSessions?: number;
}

export interface ChannelRow {
  sessionDefaultChannelGroup: string;
  sessions: number;
  activeUsers: number;
}

export interface CampaignRow {
  sessionCampaignName: string;
  sessionSourceMedium: string;
  sessions: number;
  activeUsers: number;
}

export interface DeviceRow {
  deviceCategory: string;
  activeUsers: number;
  sessions: number;
}

export interface SignupRow {
  date: string;
  count: number;
}

export interface ConversionDef {
  id: string;
  name: string;
  path: string;
}

export interface ConversionTotalItem {
  sessions: number;
  users?: number;
}

export interface ConversionRow {
  k: string;
  s: number;
  n: number;
  u?: number;
}

export interface ConversionData {
  defs: ConversionDef[];
  total: Record<string, ConversionTotalItem>;
  daily: Record<string, SignupRow[]>;
  byMedium?: Record<string, ConversionRow[]>;
  byChannel?: Record<string, ConversionRow[]>;
  byCampaign?: Record<string, ConversionRow[]>;
  byLanding?: Record<string, ConversionRow[]>;
  byGoods?: Record<string, ConversionRow[]>;
  byDevice?: Record<string, ConversionRow[]>;
}

export interface EventRow {
  eventName: string;
  eventCount: number;
  totalUsers: number;
  keyEvents?: number;
}

export interface KeyBySourceRow {
  sessionSourceMedium: string;
  sessions: number;
  keyEvents: number;
}

export interface EcomRow {
  name: string;
  viewed: number;
  cart: number;
  bought: number;
}

export interface ShopItem {
  id: string;
  title?: string;
  views: number;
}

export interface MonthData {
  v?: number;
  month: string;
  partial?: boolean;
  updated?: string;
  total: TotalMetrics;
  daily: DailyMetric[];
  pages: PageRow[];
  sources?: SourceRow[];
  channels?: ChannelRow[];
  campaigns?: CampaignRow[];
  devices?: DeviceRow[];
  signups?: SignupRow[];
  signupSource?: string;
  conv?: ConversionData;
  events?: EventRow[];
  keyBySource?: KeyBySourceRow[];
  ecom?: EcomRow[];
  goods?: ShopItem[];
  categories?: ShopItem[];
  boards?: ShopItem[];
  shopUpdated?: string;
}

export interface NamesMap {
  goods?: Record<string, string>;
  categories?: Record<string, string>;
  boards?: Record<string, string>;
}

export interface GodomallSignups {
  checkedAt?: string;
  monthly: Record<string, number>;
  daily?: Record<string, number>;
}

export interface GodomallQuotes {
  asOf?: string;
  source?: string;
  note?: string;
  monthly: Record<string, number>;
  daily?: Record<string, number>;
  byCategory?: Record<string, Record<string, number>>;
}

export interface InternalFilterConfig {
  state: 'pending' | 'testing' | 'active';
  since: string | null;
}

export interface MetaInfo {
  updated: string | null;
  failed?: number;
}

/** 보고 있는 사이트 — 아이티켓(itket.com) / 온코어(on-core.co.kr) */
export type SiteId = 'itket' | 'oncore';

export interface DashboardPayload {
  /** 빌드가 넣는 사이트 구분 (예전 빌드에는 없음 = 아이티켓) */
  site?: SiteId;
  names: NamesMap;
  godoSignups: GodomallSignups | null;
  /** 고도몰 관리자 통계의 월별 신규회원 수 (data/ref/godomall-signups-admin.json) — 회원 DB 값이 휴면 분리로 줄어든 과거 달을 채운다 */
  godoSignupsAdmin?: GodomallSignups | null;
  /** 화면이 쓰는 회원가입 바닥값 — 빌드 저장본(수집 때마다 달별 최댓값)과 관리자 통계 중 큰 값. 실시간 DB 값이 휴면 분리로 줄어도 이 아래로 내려가지 않는다 */
  godoSignupsFloor?: GodomallSignups | null;
  godoQuotes: GodomallQuotes | null;
  title: string;
  siteUrl: string;
  internal: InternalFilterConfig;
  meta: MetaInfo;
  months: Record<string, MonthData>;
  liveUrl: string;
  /** 수집 시작 달 (config startMonth · 온코어는 oncore.startMonth) — 온코어는 이 달부터 화면에 보이고, 로딩 중 기간 줄의 고를 수 있는 처음 달로 쓴다 */
  startMonth?: string;
  /** 온코어 데이터 — 아이티켓 페이로드에만 붙는다 (형식은 같음) */
  oncore?: DashboardPayload;
}

export interface LiveMinuteRow {
  minutesAgo: number | string;
  activeUsers: number;
}

export interface LivePageRow {
  unifiedScreenName: string;
  activeUsers: number;
}

export interface LiveDeviceRow {
  deviceCategory: string;
  activeUsers: number;
}

export interface LivePayload {
  at: string;
  activeUsers: number;
  stale?: boolean;
  minutes?: LiveMinuteRow[];
  pages?: LivePageRow[];
  devices?: LiveDeviceRow[];
  error?: string;
}

export interface PageAnalysisUrlRow {
  pagePathPlusQueryString: string;
  screenPageViews: number;
  activeUsers: number;
}

export interface PageAnalysisMonthlyRow {
  month: string;
  screenPageViews: number;
  activeUsers: number;
}

export interface PageAnalysisSourceRow {
  sessionSourceMedium: string;
  sessions: number;
  screenPageViews: number;
}

export interface PageAnalysisDeviceRow {
  deviceCategory: string;
  activeUsers: number;
  screenPageViews: number;
}

export interface PageAnalysisEventRow {
  eventName: string;
  eventCount: number;
}

export interface PageAnalysisEntry {
  sessions: number;
  conv: Record<string, number>;
  byMedium: Record<string, Array<{ k: string; s: number }>>;
}

export interface PageAnalysisResult {
  q?: string;
  month?: string;
  partial?: boolean;
  at?: string;
  offline?: boolean;
  error?: string;
  errors?: string[];
  total?: {
    screenPageViews?: number;
    activeUsers?: number;
    sessions?: number;
    userEngagementDuration?: number;
  };
  daily?: Array<{ date: string; screenPageViews: number }>;
  monthly?: PageAnalysisMonthlyRow[];
  sources?: PageAnalysisSourceRow[];
  devices?: PageAnalysisDeviceRow[];
  urls?: PageAnalysisUrlRow[];
  events?: PageAnalysisEventRow[];
  defs?: ConversionDef[];
  entry?: PageAnalysisEntry;
}

declare global {
  interface Window {
    __DATA__?: DashboardPayload;
  }
}
