import type { SiteId, ViewTab } from '../types/analytics';

/**
 * 화면 주소 — ad-insight 와 같은 규칙: 경로 = 어느 화면인지, 파라미터 = 그 화면 안의 조건.
 *   /analytics/itket                      종합 요약 (최신 달)
 *   /analytics/itket/conversion?m=2026-10 전환 분석 · 2026년 10월
 *   /analytics/oncore/content?m=2026      온코어 페이지 · 상품 · 2026년 연간
 *   /analytics/itket/page?q=/goods/123    URL 분석 · 검색어
 * 기간(m)이 최신 달이면 주소에서 뺀다. 예전 해시 주소(#conversion/2026-10, #page/검색어/2026-10)도 읽는다.
 */

export const SITE_IDS: SiteId[] = ['itket', 'oncore'];
const TABS: ViewTab[] = ['overview', 'conversion', 'content', 'page'];

/** 앱이 놓인 경로 — 배포본은 '/analytics' (vite base, 끝 '/' 제외), 개발 서버는 '' */
const BASE = import.meta.env.BASE_URL.replace(/\/+$/, '');

export interface Route {
  site: SiteId;
  tab: ViewTab;
  /** URL 분석 검색어 (다른 화면은 빈 문자열) */
  q: string;
  /** 기간 'YYYY-MM' 또는 'YYYY' (없으면 최신 달) */
  m: string;
}

/** 주소 경로에서 앱 경로('/analytics')를 뗀 화면 경로 — '/analytics/itket/conversion' → '/itket/conversion' */
function stripBase(pathname: string): string {
  if (!BASE) return pathname;
  if (pathname === BASE) return '/';
  return pathname.startsWith(`${BASE}/`) ? pathname.slice(BASE.length) : pathname;
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return '';
  }
}

/** 예전 해시 주소 '#2026-10' · '#conversion/2026-10' · '#page/<검색어>/2026-10' → 화면·검색어·기간 */
function fromHash(hash: string): Omit<Route, 'site'> {
  const parts = hash.split('/');
  if (parts[0] === 'page') return { tab: 'page', q: safeDecode(parts[1] || '').trim(), m: parts[2] || '' };
  if (parts[0] === 'overview' || parts[0] === 'conversion' || parts[0] === 'content') {
    return { tab: parts[0], q: '', m: parts[1] || '' };
  }
  return { tab: 'overview', q: '', m: parts[0] || '' };
}

/** 지금 주소 → 사이트·화면·검색어·기간. 사이트가 없으면 아이티켓 */
export function parseRoute(loc: Pick<Location, 'pathname' | 'search' | 'hash'> = window.location): Route {
  const parts = stripBase(loc.pathname).split('/').filter(Boolean);
  const site: SiteId = SITE_IDS.includes(parts[0] as SiteId) ? (parts.shift() as SiteId) : 'itket';
  const hash = loc.hash.replace(/^#/, '');
  if (hash) return { site, ...fromHash(hash) };
  const tab: ViewTab = TABS.includes(parts[0] as ViewTab) ? (parts[0] as ViewTab) : 'overview';
  const params = new URLSearchParams(loc.search);
  return { site, tab, q: tab === 'page' ? (params.get('q') || '').trim() : '', m: params.get('m') || '' };
}

/** 파라미터 값 — 경로 검색어의 '/' 는 그대로 둬서 주소를 읽기 쉽게 한다 */
const enc = (s: string) => encodeURIComponent(s).replace(/%2F/gi, '/');

/** 사이트·화면·검색어·기간 → 주소(앱 경로 포함). 종합 요약은 사이트만('/analytics/itket') */
export function routePath({ site, tab, q, m }: Route): string {
  const params: string[] = [];
  if (tab === 'page' && q) params.push(`q=${enc(q)}`);
  if (m) params.push(`m=${enc(m)}`);
  return `${BASE}/${site}${tab === 'overview' ? '' : `/${tab}`}${params.length ? `?${params.join('&')}` : ''}`;
}
