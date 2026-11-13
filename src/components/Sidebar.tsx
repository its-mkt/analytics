import {
  BarChart3,
  FileSearch,
  LayoutDashboard,
  ShoppingBag,
  Target,
  X,
} from 'lucide-react';
import type { ViewTab } from '../types/analytics';
import { Dropdown, type DropdownOption } from './Dropdown';

type DashboardId = 'ad-insight' | 'analytics';

/** 브랜드 선택 박스로 오가는 대시보드 — 개발 서버에서는 각 프로젝트의 로컬 서버, 배포본에서는 운영 주소로 간다 (its-ad-insight 사이드바와 같은 목록) */
const DASHBOARDS: { id: DashboardId; label: string; local: string; live: string }[] = [
  { id: 'ad-insight', label: 'its-ad-insight', local: 'http://localhost:2000/ad-insight/', live: 'https://its.itket.com/ad-insight/' },
  { id: 'analytics', label: 'its-analytics', local: 'http://localhost:1000/', live: 'https://its.itket.com/analytics/' },
];
const DASHBOARD_OPTIONS: DropdownOption<DashboardId>[] = DASHBOARDS.map((d) => ({ value: d.id, label: d.label, title: import.meta.env.DEV ? d.local : d.live }));
const goDashboard = (id: DashboardId) => {
  const d = DASHBOARDS.find((x) => x.id === id);
  if (d) window.location.href = import.meta.env.DEV ? d.local : d.live;
};

interface SidebarProps {
  title: string;
  open: boolean;
  currentTab: ViewTab;
  onCloseDrawer: () => void;
  onGoHome: () => void;
  onSelectTab: (tab: ViewTab) => void;
}

export function Sidebar({
  title,
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
        <button
          type="button"
          className="btn ic sclose"
          id="sclose"
          aria-label="메뉴 닫기"
          onClick={onCloseDrawer}
        >
          <X size={18} aria-hidden="true" />
        </button>

        {/* 브랜드: 아이콘은 처음 화면으로, 이름은 대시보드 선택 박스 (its-ad-insight ↔ its-analytics) */}
        <div className="brand" id="brand">
          <a
            className="brand-home"
            href="./"
            title={`${title} 처음으로`}
            aria-label="처음으로"
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) return;
              e.preventDefault();
              onGoHome();
            }}
          >
            <i className="brand-icon">
              <BarChart3 size={15} aria-hidden="true" />
            </i>
          </a>
          <Dropdown<DashboardId> className="brand-dd" id="dd-dashboard" ariaLabel="대시보드 선택" options={DASHBOARD_OPTIONS} value="analytics" onChange={goDashboard} />
        </div>

        <nav className="sn" id="sideNav" aria-label="사이드바 메뉴">
          <div className="lbl">대시보드</div>
          <button
            type="button"
            className={`m ${currentTab === 'overview' ? 'on' : ''}`}
            id="navOverview"
            onClick={() => onSelectTab('overview')}
          >
            <LayoutDashboard size={15} aria-hidden="true" />
            <span>종합 요약</span>
          </button>
          <button
            type="button"
            className={`m ${currentTab === 'conversion' ? 'on' : ''}`}
            id="navConversion"
            onClick={() => onSelectTab('conversion')}
          >
            <Target size={15} aria-hidden="true" />
            <span>전환 분석</span>
          </button>
          <button
            type="button"
            className={`m ${currentTab === 'content' ? 'on' : ''}`}
            id="navContent"
            onClick={() => onSelectTab('content')}
          >
            <ShoppingBag size={15} aria-hidden="true" />
            <span>페이지 · 상품</span>
          </button>

          <div className="lbl" style={{ marginTop: '0.5rem' }}>검색 · 탐색</div>
          <button
            type="button"
            className={`m ${currentTab === 'page' ? 'on' : ''}`}
            id="navPage"
            onClick={() => onSelectTab('page')}
          >
            <FileSearch size={15} aria-hidden="true" />
            <span>URL 분석</span>
          </button>
        </nav>

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
