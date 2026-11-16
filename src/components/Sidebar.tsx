import {
  Activity,
  FileSearch,
  LayoutDashboard,
  ShoppingBag,
  Target,
  type LucideIcon,
} from 'lucide-react';
import type { SiteId, ViewTab } from '../types/analytics';
import { routePath } from '../utils/route';
import { SITES } from '../utils/site';
import { VIEW_TITLES } from '../utils/views';
import { CloseButton } from './CloseButton';
import { Dropdown, type DropdownOption } from './Dropdown';
import { SegmentedControl } from './SegmentedControl';

type DashboardId = 'ad-insight' | 'analytics';

/** 브랜드 선택 박스로 오가는 대시보드 — 개발 서버에서는 각 프로젝트의 로컬 서버, 배포본에서는 운영 주소로 간다 (ad-insight 사이드바와 같은 목록) */
const DASHBOARDS: { id: DashboardId; label: string; local: string; live: string }[] = [
  { id: 'ad-insight', label: 'ad-insight', local: 'http://localhost:2000/ad-insight/', live: 'https://its.itket.com/ad-insight/' },
  { id: 'analytics', label: 'analytics', local: 'http://localhost:1000/', live: 'https://its.itket.com/analytics/' },
];
const DASHBOARD_OPTIONS: DropdownOption<DashboardId>[] = DASHBOARDS.map((d) => ({ value: d.id, label: d.label, title: import.meta.env.DEV ? d.local : d.live }));
const goDashboard = (id: DashboardId) => {
  const d = DASHBOARDS.find((x) => x.id === id);
  if (d) window.location.href = import.meta.env.DEV ? d.local : d.live;
};

interface NavItem {
  tab: ViewTab;
  id: string;
  Icon: LucideIcon;
}

// 메뉴는 ad-insight 처럼 '대시보드' 한 묶음. 이름은 헤더 경로·화면 머리말과 같은 VIEW_TITLES
const NAV_ITEMS: NavItem[] = [
  { tab: 'overview', id: 'navOverview', Icon: LayoutDashboard },
  { tab: 'conversion', id: 'navConversion', Icon: Target },
  { tab: 'content', id: 'navContent', Icon: ShoppingBag },
  { tab: 'page', id: 'navPage', Icon: FileSearch },
];

interface SidebarProps {
  title: string;
  /** 수집본 갱신 시각 (ISO) — 사이드바 아래 '… 수집' 상자 */
  updated: string | null;
  /** 보고 있는 사이트 (아이티켓 / 온코어) */
  site: SiteId;
  onSiteChange: (site: SiteId) => void;
  open: boolean;
  currentTab: ViewTab;
  onCloseDrawer: () => void;
  onGoHome: () => void;
  onSelectTab: (tab: ViewTab) => void;
}

export function Sidebar({
  title,
  updated,
  site,
  onSiteChange,
  open,
  currentTab,
  onCloseDrawer,
  onGoHome,
  onSelectTab,
}: SidebarProps) {

  return (
    <>
      <div
        className={`scrim ${open ? 'on' : ''}`}
        id="scrim"
        onClick={onCloseDrawer}
      />
      <aside className={`side ${open ? 'open' : ''}`} id="side">
        <CloseButton
          className="btn ic sclose"
          id="sclose"
          label="메뉴 닫기"
          onClick={onCloseDrawer}
        />

        {/* 브랜드: 아이콘은 처음 화면으로, 이름은 대시보드 선택 박스 (ad-insight ↔ analytics) */}
        <div className="brand" id="brand">
          <a
            className="brand-home"
            href={routePath({ site, tab: 'overview', q: '', m: '' })}
            title={`${title} 처음으로`}
            aria-label="처음으로"
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) return;
              e.preventDefault();
              onGoHome();
            }}
          >
            <i className="brand-icon">
              <Activity size={15} aria-hidden="true" />
            </i>
          </a>
          <Dropdown<DashboardId> className="brand-dd" id="dd-dashboard" ariaLabel="대시보드 선택" options={DASHBOARD_OPTIONS} value="analytics" onChange={goDashboard} />
        </div>

        {/* 사이트 선택 (아이티켓 / 온코어) — 주소 경로(/analytics/itket · /analytics/oncore)로 남아 링크를 공유해도 같은 사이트로 열린다 */}
        <SegmentedControl<SiteId>
          className="site-seg"
          id="siteSeg"
          items={SITES}
          value={site}
          onChange={onSiteChange}
          fullWidth
          size="md"
          ariaLabel="사이트 선택"
        />

        <nav className="sn" id="sideNav" aria-label="사이드바 메뉴">
          <div className="lbl">대시보드</div>
          {NAV_ITEMS.map(({ tab, id, Icon }) => (
            <button
              key={tab}
              type="button"
              className={`m ${currentTab === tab ? 'on' : ''}`}
              id={id}
              aria-current={currentTab === tab ? 'page' : undefined}
              onClick={() => onSelectTab(tab)}
            >
              <Icon size={15} aria-hidden="true" />
              <span>{VIEW_TITLES[tab]}</span>
            </button>
          ))}
        </nav>

        {/* 수집 상태 — ad-insight 사이드바 아래 '… 수집' 상자와 같은 자리 */}
        <UpdatedBox updated={updated} />

        {/* 마케팅팀 · 배포 날짜 기준 릴리즈 표기 */}
        <div className="side-foot" id="sideReleaseFoot">
          <span className="team">마케팅팀</span> ·{' '}
          <span
            className="rel"
            title={
              typeof __APP_COMMIT__ !== 'undefined' && __APP_COMMIT__
                ? `커밋 ${__APP_COMMIT__}`
                : undefined
            }
          >
            {typeof __APP_RELEASE__ !== 'undefined'
              ? __APP_RELEASE__
              : 'v26.10.20'}
          </span>
        </div>
      </aside>
    </>
  );
}

/** 수집본 갱신 시각 → '2026-11-16 14:31 수집'. 6시간 넘게 갱신이 없으면 지연 표시 (자동 수집은 30분~3시간 간격) */
function UpdatedBox({ updated }: { updated: string | null }) {
  if (!updated) return <div className="side-upd stale">아직 수집된 데이터가 없습니다</div>;
  const u = new Date(updated);
  const h = (Date.now() - u.getTime()) / 36e5;
  const at = new Date(u.getTime() + 9 * 3600e3).toISOString().slice(0, 16).replace('T', ' ');
  const rel = h < 1 ? '방금' : h < 24 ? `${Math.round(h)}시간 전` : `${Math.round(h / 24)}일 전`;
  const stale = h > 6;
  return (
    <div className={`side-upd${stale ? ' stale' : ''}`} id="upd" title={`마지막 갱신 ${at} (${rel})`}>
      {at} 수집{stale ? ' · 갱신 지연' : ''}
    </div>
  );
}
