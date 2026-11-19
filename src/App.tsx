import { useEffect, useState } from 'react';
import { EmptyState } from './components/EmptyState';
import { ExportModal } from './components/ExportModal';
import { Header } from './components/Header';
import { LivePanel } from './components/LivePanel';
import { MonthView } from './components/MonthView';
import { PageAnalysisView } from './components/PageAnalysisView';
import { PageDrawer } from './components/PageDrawer';
import { PageHeader } from './components/PageHeader';
import { PeriodNav } from './components/PeriodNav';
import { SearchDialog } from './components/SearchDialog';
import { Sidebar } from './components/Sidebar';
import { YearView } from './components/YearView';
import { baseData, loadSitePayload, useDashboardData } from './hooks/useDashboardData';
import { Button } from './components/Button';
import { MonthViewSkeleton } from './components/DashboardSkeleton';
import { PageAnalysisSkeleton } from './components/PageAnalysisSkeleton';
import { useRoute } from './hooks/useRoute';
import { useTheme } from './hooks/useTheme';
import type { ConvByKey, DashboardPayload, MetricKey, ShopTabKey, SiteId, ViewTab } from './types/analytics';
import type { SearchAction } from './utils/search';
import { parseRoute, routePath } from './utils/route';
import { VIEW_DESC, VIEW_TITLES, YEAR_TITLE, yearDesc } from './utils/views';

/** 사이트(아이티켓 / 온코어)는 주소 경로(/analytics/itket · /analytics/oncore)가 기준. 바꾸면 대시보드를 새로 그려 기간·탭·열린 창 상태를 그 사이트 기준으로 다시 잡는다 */
export function App() {
  const [site, setSite] = useState<SiteId>(() => parseRoute().site);

  useEffect(() => {
    const onPopState = () => setSite(parseRoute().site);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // 사이트만 바꾸고 보던 화면·기간·검색어는 그대로 (그 사이트에 없는 기간이면 최신 달로 연다)
  const changeSite = (next: SiteId) => {
    if (next === site) return;
    history.pushState(null, '', routePath({ ...parseRoute(), site: next }));
    setSite(next);
    window.scrollTo({ top: 0 });
  };

  return <SiteLoader key={site} site={site} onSiteChange={changeSite} />;
}

/**
 * 그 사이트 데이터를 웹앱에서 받은 뒤 대시보드를 그린다.
 * 받는 동안은 보던 화면 모양의 로딩 틀, 실패하면 다시 시도 안내.
 */
function SiteLoader({ site, onSiteChange }: { site: SiteId; onSiteChange: (site: SiteId) => void }) {
  const [state, setState] = useState<{ data?: DashboardPayload; error?: string }>({});
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setState({});
    loadSitePayload(site).then((res) => alive && setState(res));
    return () => {
      alive = false;
    };
  }, [site, tick]);

  if (state.data) return <Dashboard site={site} initial={state.data} onSiteChange={onSiteChange} />;
  return <LoadingShell site={site} error={!!state.error} onRetry={() => setTick((n) => n + 1)} onSiteChange={onSiteChange} />;
}

/**
 * 데이터를 받는 동안의 화면 — ad-insight 처럼 사이드바·헤더·화면 머리말은 그대로 그리고 본문만 로딩 틀로 둔다.
 * 사이드바 메뉴를 누르면 주소만 바꿔 그 화면 모양의 로딩 틀로 바꾼다 (데이터가 오면 그 화면으로 열린다).
 */
function LoadingShell({ site, error, onRetry, onSiteChange }: { site: SiteId; error: boolean; onRetry: () => void; onSiteChange: (site: SiteId) => void }) {
  const { isDark, toggleTheme } = useTheme();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [, rerender] = useState(0);
  const route = parseRoute();
  const isYear = route.tab !== 'page' && /^d{4}$/.test(route.m);
  const title = isYear ? YEAR_TITLE : VIEW_TITLES[route.tab];
  const desc = isYear ? yearDesc(route.m) : VIEW_DESC[route.tab];
  const maxMonth = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 7); // 이번 달 (한국 시간)
  const minMonth = baseData(site).startMonth || '2025-01';
  const years = Array.from({ length: +maxMonth.slice(0, 4) - +minMonth.slice(0, 4) + 1 }, (_, i) => String(+minMonth.slice(0, 4) + i));
  const period = route.tab === 'page' ? (/^d{4}-d{2}$/.test(route.m) ? route.m : maxMonth) : route.m || maxMonth;
  const pickPeriod = (m: string) => {
    history.pushState(null, '', routePath({ ...route, m: m === maxMonth ? '' : m }));
    rerender((n) => n + 1);
  };
  const go = (tab: ViewTab) => {
    history.pushState(null, '', routePath({ ...route, tab, q: '', m: '' }));
    setDrawerOpen(false);
    rerender((n) => n + 1);
  };

  return (
    <div className="app">
      <Sidebar
        title={baseData(site).title}
        updated={undefined}
        site={site}
        onSiteChange={(next) => {
          setDrawerOpen(false);
          onSiteChange(next);
        }}
        open={drawerOpen}
        currentTab={route.tab}
        onCloseDrawer={() => setDrawerOpen(false)}
        onGoHome={() => go('overview')}
        onSelectTab={go}
      />
      <div className="wrap">
        <Header title={title} drawerOpen={drawerOpen} isDark={isDark} onOpenDrawer={() => setDrawerOpen(true)} onToggleTheme={toggleTheme} onSearch={() => {}} />
        {/* 기간 줄은 데이터가 없어도 고를 수 있다 (수집 시작 달 ~ 이번 달). 집계 기준 안내만 데이터가 온 뒤에 붙는다 */}
        <PeriodNav years={years} selectedPeriod={period} minAvailableMonth={minMonth} maxAvailableMonth={maxMonth} onSelectPeriod={pickPeriod} />
        <div className="cont" aria-busy={!error}>
          <PageHeader id="pageHeader" title={title} desc={desc} />
          <LivePanel liveUrl={baseData(site).liveUrl} />
          <main id="main">
            {error ? (
              <EmptyState>
                데이터를 불러오지 못했습니다.{' '}
                <Button size="sm" onClick={onRetry}>
                  다시 시도
                </Button>
              </EmptyState>
            ) : route.tab === 'page' ? (
              <PageAnalysisSkeleton />
            ) : (
              <MonthViewSkeleton tab={route.tab} hasEstimate={site === 'itket'} />
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

function Dashboard({ site, initial, onSiteChange }: { site: SiteId; initial: DashboardPayload; onSiteChange: (site: SiteId) => void }) {
  const { data, keys, years, latestKey, godoQuotesLoading } = useDashboardData(initial);
  const {
    isPage,
    currentTab,
    pageQ,
    pageM,
    sel,
    setPageM,
    selectPeriod,
    selectTab,
    openPage,
    resetRoute,
  } = useRoute(site, keys, years, data.months);
  const { isDark, toggleTheme } = useTheme();

  const [chartMetric, setChartMetric] = useState<MetricKey>('activeUsers');
  const [annMetric, setAnnMetric] = useState<MetricKey>('sessions');
  const [shopTab, setShopTab] = useState<ShopTabKey>('goods');
  const [convBy, setConvBy] = useState<ConvByKey>('byMedium');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  // 헤더 검색 창 (버튼 · Ctrl+K)
  const [searchOpen, setSearchOpen] = useState(false);

  // 슬라이드오버 Drawer 상태
  const [pageDrawerQuery, setPageDrawerQuery] = useState<string | null>(null);

  useEffect(() => {
    document.body.classList.toggle('lock', drawerOpen);
  }, [drawerOpen]);

  useEffect(() => {
    document.title = data.title;
  }, [data.title]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false);
      // Ctrl+K (맥 ⌘K) — 헤더 검색 버튼과 같이 검색 창을 연다 (ad-insight 검색 단축키와 같은 키)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setDrawerOpen(false);
        setSearchOpen(true);
      }
    };
    const onResize = () => {
      if (window.innerWidth > 768) setDrawerOpen(false);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  // 검색할 달 — URL 분석 중이면 그 달, 연간 화면이면 그 해에서 데이터가 있는 마지막 달, 아니면 보고 있는 달
  const searchMonth = isPage
    ? pageM || latestKey
    : /^d{4}$/.test(sel)
      ? [...keys].reverse().find((k) => k.startsWith(sel)) || latestKey
      : sel || latestKey;

  /** 검색 결과 고름 — 페이지·상품·카테고리·게시판은 URL 분석, 유입 매체·캠페인은 전환 분석의 그 표로 */
  const handleSearchPick = (action: SearchAction, month: string) => {
    setSearchOpen(false);
    if (action.kind === 'page') {
      handleOpenPage(action.query, month);
    } else {
      setConvBy(action.by);
      if (sel !== month && !isPage) selectPeriod(month);
      selectTab('conversion');
    }
  };

  const handleGoHome = () => {
    setConvBy('byMedium');
    setChartMetric('activeUsers');
    setAnnMetric('sessions');
    setShopTab('goods');
    setDrawerOpen(false);
    resetRoute();
  };

  const handleSelectPeriod = (period: string, keepDrawer = false) => {
    if (isPage) {
      setPageM(period);
      openPage(pageQ, period);
    } else {
      selectPeriod(period);
    }
    setPageDrawerQuery(null);
    if (!keepDrawer) setDrawerOpen(false);
  };

  const handleOpenPage = (q?: string, m?: string) => {
    openPage(q, m);
    setPageDrawerQuery(null);
    setDrawerOpen(false);
  };

  // 테이블 행 클릭 시 슬라이드오버 Drawer 오픈
  const handleOpenDrawerPage = (q: string) => {
    setPageDrawerQuery(q);
  };

  // 헤더 경로 · 기간 줄 안내 — ad-insight 와 같은 구성 (화면 이름은 헤더, 기간 기준은 기간 줄)
  const isYear = !isPage && /^d{4}$/.test(sel);
  const viewTitle = isPage ? VIEW_TITLES.page : isYear ? YEAR_TITLE : VIEW_TITLES[currentTab];
  const viewDesc = isPage ? VIEW_DESC.page : isYear ? yearDesc(sel) : VIEW_DESC[currentTab];
  const periodSel = isPage ? pageM || latestKey : sel;
  const periodNote = (() => {
    if (/^d{4}$/.test(periodSel)) {
      const n = keys.filter((k) => k.startsWith(periodSel)).length;
      return n >= 12 ? `${periodSel}년 12개월 전체 집계` : `${periodSel}년 ${n}개월 누적`;
    }
    const md = data.months[periodSel];
    if (!md) return undefined;
    const mm = +periodSel.slice(5);
    return md.partial
      ? `${mm}월은 ${md.daily.length}일차까지 집계 · 전월 대비는 전월 한 달 전체와 비교합니다`
      : `${mm}월 마감 완료`;
  })();

  const handleExportExcel = () => {
    setExportModalOpen(true);
  };

  return (
    <div className="app">
      <Sidebar
        title={data.title}
        updated={data.meta.updated}
        site={site}
        onSiteChange={(next) => {
          setDrawerOpen(false);
          onSiteChange(next);
        }}
        open={drawerOpen}
        currentTab={currentTab}
        onCloseDrawer={() => setDrawerOpen(false)}
        onGoHome={handleGoHome}
        onSelectTab={(tab) => {
          selectTab(tab);
          setDrawerOpen(false);
        }}
      />

      <div className="wrap">
        <Header
          title={viewTitle}
          drawerOpen={drawerOpen}
          isDark={isDark}
          onOpenDrawer={() => setDrawerOpen(true)}
          onToggleTheme={toggleTheme}
          onSearch={() => {
            setDrawerOpen(false);
            setSearchOpen(true);
          }}
          onExportExcel={handleExportExcel}
        />

        {keys.length > 0 && (
          <PeriodNav
            years={years}
            selectedPeriod={isPage ? (pageM || latestKey) : sel}
            minAvailableMonth={keys[0]}
            maxAvailableMonth={latestKey}
            onSelectPeriod={(period) => handleSelectPeriod(period, false)}
            note={periodNote}
          />
        )}

        <div className="cont">
          {/* 화면 머리말 → 실시간 → 본문 (ad-insight 처럼 머리말이 맨 위) */}
          {(isPage || keys.length > 0) && <PageHeader id="pageHeader" title={viewTitle} desc={viewDesc} />}
          <LivePanel liveUrl={data.liveUrl} />

          <main id="main">
            {isPage ? (
              <PageAnalysisView
                siteUrl={data.siteUrl}
                pageQ={pageQ}
                pageM={pageM}
                keys={keys}
                months={data.months}
                names={data.names}
                liveUrl={data.liveUrl}
                onOpenPage={handleOpenPage}
                onChangeMonthOnly={setPageM}
                onBackToDashboard={() => handleSelectPeriod(pageM || latestKey, false)}
              />
            ) : !keys.length ? (
              <EmptyState>
                아직 수집된 데이터가 없습니다.
                <br />
                저장소의 Actions에서 “Update Dashboard”를 실행하면 첫 수집이 시작됩니다.
              </EmptyState>
            ) : /^\d{4}$/.test(sel) ? (
              <YearView
                siteUrl={data.siteUrl}
                year={sel}
                months={data.months}
                godoSignups={data.godoSignups}
                godoQuotes={data.godoQuotes}
                annMetric={annMetric}
                onChangeAnnMetric={setAnnMetric}
                onSelectMonth={(mKey) => handleSelectPeriod(mKey, false)}
              />
            ) : (
              <MonthView
                site={site}
                siteUrl={data.siteUrl}
                monthKey={sel}
                months={data.months}
                names={data.names}
                internal={data.internal}
                godoSignups={data.godoSignups}
                godoQuotes={data.godoQuotes}
                godoQuotesLoading={godoQuotesLoading}
                currentTab={currentTab as 'overview' | 'conversion' | 'content'}
                chartMetric={chartMetric}
                shopTab={shopTab}
                convBy={convBy}
                onChangeChartMetric={setChartMetric}
                onChangeShopTab={setShopTab}
                onChangeConvBy={setConvBy}
                onOpenPage={(q) => handleOpenDrawerPage(q)}
                onOpenTab={(tab) => {
                  selectTab(tab);
                  setDrawerOpen(false);
                }}
              />
            )}
          </main>
        </div>
      </div>

      {searchOpen && (
        <SearchDialog
          monthKey={searchMonth}
          month={data.months[searchMonth]}
          names={data.names}
          onClose={() => setSearchOpen(false)}
          onPick={handleSearchPick}
        />
      )}

      <ExportModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        data={data}
        currentSel={sel}
        keys={keys}
        years={years}
      />

      <PageDrawer
        isOpen={!!pageDrawerQuery}
        onClose={() => setPageDrawerQuery(null)}
        pageQ={pageDrawerQuery || ''}
        pageM={sel}
        keys={keys}
        months={data.months}
        names={data.names}
        liveUrl={data.liveUrl}
        onOpenFullPage={(q, m) => handleOpenPage(q, m)}
      />
    </div>
  );
}
