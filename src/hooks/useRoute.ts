import { useCallback, useEffect, useMemo, useState } from 'react';
import type { MonthData, SiteId, ViewTab } from '../types/analytics';
import { parseRoute, routePath } from '../utils/route';

interface RouteState {
  isPage: boolean;
  pageQ: string;
  pageM: string;
  sel: string;
  tab: ViewTab;
}

/** 주소(경로·파라미터) → 화면 상태. 모르는 기간은 최신 달로 */
function readRoute(keys: string[], years: string[], months: Record<string, MonthData>): RouteState {
  const latestKey = keys[keys.length - 1] || '';
  const { tab, q, m } = parseRoute();
  if (tab === 'page') {
    return { isPage: true, pageQ: q, pageM: /^\d{4}-\d{2}$/.test(m) ? m : latestKey, sel: latestKey, tab };
  }
  const sel = m && (months[m] || years.includes(m)) ? m : latestKey;
  return { isPage: false, pageQ: '', pageM: latestKey, sel, tab };
}

/**
 * 화면(탭)·기간·URL 분석 검색어를 주소와 맞춘다 (src/utils/route.ts 규칙).
 * 사이트 안에서 화면을 바꾸면 기록을 남기지 않고(replaceState) 주소만 바꾼다. 사이트 전환은 App 이 pushState 한다.
 */
export function useRoute(
  site: SiteId,
  keys: string[],
  years: string[],
  months: Record<string, MonthData>,
) {
  const latestKey = keys[keys.length - 1] || '';
  const initialRoute = useMemo(
    () => readRoute(keys, years, months),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [isPage, setIsPage] = useState(initialRoute.isPage);
  const [pageQ, setPageQ] = useState(initialRoute.pageQ);
  const [pageM, setPageM] = useState(initialRoute.pageM);
  const [sel, setSel] = useState(initialRoute.sel);
  const [currentTab, setCurrentTab] = useState<ViewTab>(initialRoute.tab);

  /** 화면 상태 → 주소. 최신 달은 m 을 뺀다 */
  const writeRoute = useCallback(
    (tab: ViewTab, q: string, m: string) => {
      const path = routePath({ site, tab, q, m: m === latestKey ? '' : m });
      if (location.pathname + location.search + location.hash !== path) history.replaceState(null, '', path);
    },
    [site, latestKey],
  );

  // 처음 열 때 정식 주소로 맞춘다 — 사이트 없는 '/analytics/', 예전 해시 주소, 모르는 기간 등
  useEffect(() => {
    writeRoute(initialRoute.tab, initialRoute.pageQ, initialRoute.isPage ? initialRoute.pageM : initialRoute.sel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 뒤로·앞으로 가기
  useEffect(() => {
    const onPopState = () => {
      const next = readRoute(keys, years, months);
      setIsPage(next.isPage);
      setCurrentTab(next.tab);
      if (next.isPage) {
        setPageQ(next.pageQ);
        setPageM((prevM) => next.pageM || prevM || latestKey);
      } else {
        setSel(next.sel);
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [keys, years, months, latestKey]);

  const openPage = useCallback(
    (query?: string, month?: string) => {
      const trimmed = (query ?? '').trim();
      const targetM = month || pageM || latestKey;
      setIsPage(true);
      setCurrentTab('page');
      setPageQ(trimmed);
      setPageM(targetM);
      writeRoute('page', trimmed, targetM);
      window.scrollTo({ top: 0 });
    },
    [pageM, latestKey, writeRoute],
  );

  const selectPeriod = useCallback(
    (period: string) => {
      const tab = currentTab === 'page' ? 'overview' : currentTab;
      setIsPage(false);
      setCurrentTab(tab);
      setSel(period);
      writeRoute(tab, '', period);
      window.scrollTo({ top: 0 });
    },
    [currentTab, writeRoute],
  );

  const selectTab = useCallback(
    (tab: ViewTab) => {
      if (tab === 'page') {
        openPage('', sel);
        return;
      }
      setIsPage(false);
      setCurrentTab(tab);
      writeRoute(tab, '', sel);
      window.scrollTo({ top: 0 });
    },
    [sel, openPage, writeRoute],
  );

  const resetRoute = useCallback(() => {
    setIsPage(false);
    setCurrentTab('overview');
    setSel(latestKey);
    writeRoute('overview', '', latestKey);
    window.scrollTo({ top: 0 });
  }, [latestKey, writeRoute]);

  return {
    isPage,
    currentTab,
    pageQ,
    pageM: pageM || latestKey,
    sel,
    setPageM,
    selectPeriod,
    selectTab,
    openPage,
    resetRoute,
  };
}
