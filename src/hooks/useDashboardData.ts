import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DashboardPayload, GodomallQuotes, GodomallSignups, MonthData, SiteId } from '../types/analytics';
import { mergeSignups } from '../utils/metrics';
import { webappUrl, wrongSite } from '../utils/site';
import { fetchWebapp } from '../lib/webapp';

const DEFAULT_DATA: DashboardPayload = {
  names: {},
  godoSignups: null,
  godoQuotes: null,
  title: '아이티켓 애널리틱스',
  siteUrl: 'https://itket.com',
  internal: { state: 'pending', since: null },
  meta: { updated: null },
  months: {},
  liveUrl: '',
};

const CURRENT_MONTH_POLL_MS = 300_000; // 5 minutes

/** 빌드가 심은 공개 값(제목·주소·이름표)에서 그 사이트 몫을 꺼낸다 — 실적(월별 값·견적·가입)은 들어 있지 않다 */
export function baseData(site: SiteId): DashboardPayload {
  const w = typeof window !== 'undefined' ? window.__DATA__ : undefined;
  const root = { ...DEFAULT_DATA, ...((w && typeof w === 'object' ? w : {}) as Partial<DashboardPayload>) };
  if (site === 'itket') return { ...root, oncore: undefined };
  const oc = root.oncore;
  return {
    ...DEFAULT_DATA,
    title: '온코어 애널리틱스',
    siteUrl: 'https://on-core.co.kr',
    ...oc,
    site: 'oncore',
    months: {},
    godoQuotes: null,
    godoSignups: null,
    liveUrl: root.liveUrl ? webappUrl(root.liveUrl, 'site=oncore') : '',
  };
}

/** 수집기 웹앱 전체 응답 (기본 모드) */
interface WebappStore {
  error?: string;
  site?: string;
  updated?: string;
  errors?: string[];
  months?: Record<string, MonthData>;
  godoQuotes?: GodomallQuotes | null;
  godoSignups?: GodomallSignups | null;
}

/**
 * 그 사이트의 대시보드 데이터를 받는다 — 로그인 토큰을 붙여 수집기 웹앱에서 전체 달을 받는다 (예전에는 빌드가 화면에 심었다).
 * 온코어는 수집 시작 달(startMonth) 이후 세션이 있고 화면이 그릴 수 있는 형식(pages 있음)인 달만 남긴다 (예전 collect.mjs 기준 그대로).
 */
export async function loadSitePayload(site: SiteId): Promise<{ data?: DashboardPayload; error?: string }> {
  const base = baseData(site);
  if (!base.liveUrl) return { error: 'no_webapp' };
  try {
    const store = await fetchWebapp<WebappStore>(base.liveUrl, '');
    if (store.error) return { error: store.error };
    if (!store.months || wrongSite(base.liveUrl, store)) return { error: 'bad_payload' };
    let months = store.months;
    if (site === 'oncore') {
      const from = base.startMonth || '0000-00';
      months = Object.fromEntries(Object.entries(months).filter(([m, v]) => m >= from && v.total?.sessions > 0 && !(v as { empty?: boolean }).empty && v.pages));
    }
    const signups = store.godoSignups ?? null;
    return {
      data: {
        ...base,
        months,
        meta: { updated: store.updated || null, failed: (store.errors || []).length },
        godoQuotes: site === 'itket' ? store.godoQuotes ?? null : null,
        godoSignups: site === 'itket' ? signups : null,
        godoSignupsFloor: site === 'itket' ? signups : null,
      },
    };
  } catch {
    return { error: 'network' };
  }
}

/** 받은 대시보드 데이터(initial)로 화면을 그리고, 당월·전월 값은 5분마다 웹앱에서 새로 받는다 */
export function useDashboardData(initial: DashboardPayload) {
  const [data, setData] = useState<DashboardPayload>(initial);
  const godoQuotesLoading = false;

  const keys = useMemo(() => Object.keys(data.months).sort(), [data.months]);
  const years = useMemo(
    () => [...new Set(keys.map((k) => k.slice(0, 4)))],
    [keys],
  );
  const latestKey = keys[keys.length - 1] || '';

  const pollCur = useCallback(async () => {
    if (!data.liveUrl || document.visibilityState === 'hidden') return;
    try {
      const payload = await fetchWebapp<{
        months?: Record<string, MonthData>;
        updated?: string;
        godoQuotes?: GodomallQuotes | null;
        godoSignups?: GodomallSignups | null;
      }>(data.liveUrl, 'mode=cur');
      if (!payload.months || wrongSite(data.liveUrl, payload)) {
        return;
      }

      setData((prev) => {
        let changed = false;
        const nextMonths = { ...prev.months };
        for (const [k, monthVal] of Object.entries(payload.months!)) {
          const old = nextMonths[k];
          if (!old || old.updated !== monthVal.updated) {
            nextMonths[k] = monthVal;
            changed = true;
          }
        }
        const nextUpdated =
          payload.updated && payload.updated !== prev.meta.updated
            ? payload.updated
            : prev.meta.updated;
        if (nextUpdated !== prev.meta.updated) changed = true;
        const nextGodoQuotes =
          'godoQuotes' in payload ? (payload.godoQuotes ?? null) : prev.godoQuotes;
        if (nextGodoQuotes !== prev.godoQuotes) changed = true;
        // 가입 실데이터(고도몰 DB 일별) — 조회 실패(null)면 빌드 스냅샷(월 합계)을 그대로 둔다
        const nextGodoSignups = payload.godoSignups ? mergeSignups(payload.godoSignups, prev.godoSignupsFloor) : prev.godoSignups;
        if (nextGodoSignups !== prev.godoSignups) changed = true;
        if (!changed) return prev;
        return {
          ...prev,
          months: nextMonths,
          meta: { ...prev.meta, updated: nextUpdated },
          godoQuotes: nextGodoQuotes,
          godoSignups: nextGodoSignups,
        };
      });
    } catch {
      // Ignore transient network errors during background polling
    }
  }, [data.liveUrl]);

  useEffect(() => {
    if (!data.liveUrl) return;
    pollCur();
    const timer = setInterval(pollCur, CURRENT_MONTH_POLL_MS);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        pollCur();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [data.liveUrl, pollCur]);

  return { data, keys, years, latestKey, godoQuotesLoading };
}
