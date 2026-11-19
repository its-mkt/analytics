import { supabase } from './supabase';

/**
 * 열람 권한 — ad-insight 와 같은 계정·승인 명단(데이터 시트 admins·members 탭)을 쓴다.
 * 가입 요청·권한 확인은 ad-insight 웹앱이 맡고, 데이터는 GA4 수집기 웹앱이 같은 명단으로 확인한 뒤 내려준다.
 * admin(관리자) · member(승인됨) · pending(승인 대기) · rejected(거절) · revoked(해제) · none(가입 요청 없음)
 * · invalid(토큰 만료·오류) · guest(로그인 안 함)
 */
export type AccessRole = 'admin' | 'member' | 'pending' | 'rejected' | 'revoked' | 'none' | 'invalid' | 'guest';

/** ad-insight 웹앱 — 권한 확인(whoami)·가입 요청을 받는다 */
const ACCESS_WEBAPP_URL =
  'https://script.google.com/macros/s/AKfycbzQS9yMlp9L_eRaH77QWLsY6GOY7L5hyRk1fkuaAHg8GvJmHHwhPRgr2zWldgbX5-cNcg/exec';

/** 데이터를 받을 수 있는 권한인지 */
export const canViewRole = (role: AccessRole | null): boolean => role === 'admin' || role === 'member';

/** 데이터를 받다가 권한이 없다고 답하면(승인 해제·토큰 만료) 보내는 알림 — AuthContext 가 권한을 다시 확인한다 */
export const ACCESS_CHANGED_EVENT = 'ana:access-changed';

/** 지금 로그인 토큰 (없으면 '') */
export async function currentAccessToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || '';
}

const withParam = (url: string, param: string) => `${url}${url.includes('?') ? '&' : '?'}${param}`;

/** 로그인 토큰의 권한만 묻는다. 확인에 실패하면 null */
export async function fetchAccessRole(token: string): Promise<AccessRole | null> {
  if (!token) return 'guest';
  try {
    const res = await fetch(withParam(`${ACCESS_WEBAPP_URL}?whoami=1`, `access_token=${encodeURIComponent(token)}`));
    const j = (await res.json()) as { role?: AccessRole };
    return j.role || null;
  } catch {
    return null;
  }
}

/** 열람 요청 — ad-insight 웹앱이 로그인 토큰의 이메일을 명단에 승인 대기로 넣고 관리자에게 팀즈·메일로 알린다 */
export async function postAccessRequest(name: string, team: string, token?: string): Promise<{ success?: boolean; error?: string }> {
  const res = await fetch(ACCESS_WEBAPP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action: 'requestAccess', access_token: token || (await currentAccessToken()), name, team }),
  });
  return (await res.json()) as { success?: boolean; error?: string };
}

/**
 * 수집기 웹앱에서 JSON 을 받는다 — 로그인 토큰을 붙이고, 권한이 없다는 답이면 권한을 다시 확인하게 알린다.
 * params 는 'mode=live' 처럼 붙일 조회 조건 (없으면 '')
 */
export async function fetchWebapp<T>(liveUrl: string, params: string): Promise<T> {
  const token = await currentAccessToken();
  let url = params ? withParam(liveUrl, params) : liveUrl;
  if (token) url = withParam(url, `access_token=${encodeURIComponent(token)}`);
  const res = await fetch(url);
  const body = (await res.json()) as T & { error?: string };
  if (body && body.error === 'login_required') window.dispatchEvent(new Event(ACCESS_CHANGED_EVENT));
  return body;
}
