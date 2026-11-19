const withParam = (url: string, param: string) => `${url}${url.includes('?') ? '&' : '?'}${param}`;

/**
 * 수집기 웹앱에서 JSON 을 받는다 (로그인 없이 공개).
 * params 는 'mode=live' 처럼 붙일 조회 조건 (없으면 '')
 */
export async function fetchWebapp<T>(liveUrl: string, params: string): Promise<T> {
  const res = await fetch(params ? withParam(liveUrl, params) : liveUrl);
  return (await res.json()) as T;
}
