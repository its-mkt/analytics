import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DashboardPayload, GodomallQuotes, GodomallSignups, MonthData, SiteId } from '../types/analytics';
import { mergeSignups } from '../utils/metrics';
import { webappUrl, wrongSite } from '../utils/site';

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

/** 빌드가 심은 데이터에서 그 사이트 값을 꺼낸다. 온코어는 수집기 주소에 site=oncore 를 붙여 같은 웹앱의 온코어 응답을 받는다 */
function initialData(site: SiteId): DashboardPayload {
  const w = typeof window !== 'undefined' ? window.__DATA__ : undefined;
  const root = (w && typeof w === 'object' ? w : DEFAULT_DATA) as DashboardPayload;
  if (site === 'itket') {
    const floor = mergeSignups(root.godoSignups, root.godoSignupsAdmin);
    return { ...root, oncore: undefined, godoSignups: floor, godoSignupsFloor: floor };
  }
  const oc = root.oncore;
  return {
    ...(oc ?? { ...DEFAULT_DATA, title: '온코어 애널리틱스', siteUrl: 'https://on-core.co.kr', months: {} }),
    site: 'oncore',
    godoQuotes: null,
    godoSignups: null,
    liveUrl: root.liveUrl ? webappUrl(root.liveUrl, 'site=oncore') : '',
  };
}

export function useDashboardData(site: SiteId = 'itket') {
  const [data, setData] = useState<DashboardPayload>(() => ({ ...initialData(site), godoQuotes: null })); // 빌드 스냅샷 억제: 최초 live poll 결과로 교체

  // live poll이 완료될 때까지 견적 카드를 스켈레톤으로 표시 (견적 실데이터는 아이티켓만 있다)
  const [godoQuotesLoading, setGodoQuotesLoading] = useState(() => site === 'itket' && !!initialData(site).liveUrl);

  const keys = useMemo(() => Object.keys(data.months).sort(), [data.months]);
  const years = useMemo(
    () => [...new Set(keys.map((k) => k.slice(0, 4)))],
    [keys],
  );
  const latestKey = keys[keys.length - 1] || '';

  const pollCur = useCallback(async () => {
    if (!data.liveUrl || document.visibilityState === 'hidden') return;
    try {
      const res = await fetch(webappUrl(data.liveUrl, 'mode=cur'));
      const payload = (await res.json()) as {
        months?: Record<string, MonthData>;
        updated?: string;
        godoQuotes?: GodomallQuotes | null;
        godoSignups?: GodomallSignups | null;
      };
      if (!payload.months || wrongSite(data.liveUrl, payload)) {
        setGodoQuotesLoading(false);
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
    } finally {
      setGodoQuotesLoading(false);
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
