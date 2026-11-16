import type { SiteId } from '../types/analytics';

export const SITES: Array<[SiteId, string]> = [
  ['itket', '아이티켓'],
  ['oncore', '온코어'],
];

/** 수집기 웹앱 주소에 조회 조건을 붙인다. 온코어 화면의 웹앱 주소에는 이미 ?site=oncore 가 붙어 있다 */
export function webappUrl(liveUrl: string, params: string): string {
  return `${liveUrl}${liveUrl.includes('?') ? '&' : '?'}${params}`;
}

/**
 * 온코어로 물었는데 아이티켓 값이 온 응답인지. 수집기(Code.gs)에 온코어 모드가 없는 버전이면 site=oncore 를 모르고
 * 아이티켓 값을 돌려주므로, 응답에 site: 'oncore' 가 없으면 버린다 (온코어 화면에 아이티켓 숫자가 섞이지 않게).
 */
export function wrongSite(liveUrl: string, payload: unknown): boolean {
  return liveUrl.includes('site=oncore') && (payload as { site?: string } | null)?.site !== 'oncore';
}
