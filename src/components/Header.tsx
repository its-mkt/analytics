import { FileSpreadsheet, LogOut, Menu, Moon, Search, Sun } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from './Button';

interface HeaderProps {
  /** 지금 화면 이름 (경로의 마지막 칸) — 화면 머리말과 같은 이름 */
  title: string;
  drawerOpen: boolean;
  isDark: boolean;
  onOpenDrawer: () => void;
  onToggleTheme: () => void;
  /** 헤더 검색 버튼 → 검색 창 */
  onSearch: () => void;
  onExportExcel?: () => void;
}

/**
 * 상단 헤더 — ad-insight 와 같은 구성: 왼쪽 '대시보드 이름 / 화면 이름', 오른쪽 검색 · (엑셀) · 테마.
 * 마지막 갱신 시각은 ad-insight 처럼 사이드바 아래에 둔다.
 */
export function Header({ title, drawerOpen, isDark, onOpenDrawer, onToggleTheme, onSearch, onExportExcel }: HeaderProps) {
  const { user, logout } = useAuth();
  return (
    <header className="top">
      <Button
        className="icon burger"
        id="burger"
        aria-label="메뉴 열기"
        aria-expanded={drawerOpen}
        aria-controls="side"
        onClick={onOpenDrawer}
        icon={<Menu size={18} aria-hidden="true" />}
      />

      <h1>
        <span className="crumb-root">방문 &amp; 전환 대시보드 </span>
        <span className="crumb" id="crumb">
          {title}
        </span>
      </h1>

      <span className="spacer" />

      <div className="acts">
        <Button
          className="icon top-search"
          id="btnSearch"
          aria-label="검색"
          title="검색 (Ctrl+K)"
          onClick={onSearch}
          icon={<Search size={18} aria-hidden="true" />}
        />

        {onExportExcel && (
          <Button
            className="btn-excel"
            id="btnExportExcel"
            title="현재 화면의 실적 데이터를 엑셀(.xlsx)로 다운로드합니다"
            onClick={onExportExcel}
            icon={<FileSpreadsheet size={15} aria-hidden="true" />}
          >
            엑셀 다운로드
          </Button>
        )}

        {/* 테마 스위치 — 모양이 달라(.tgl) 공용 Button 이 아닌 전용 마크업 */}
        <button
          type="button"
          className="toggle"
          id="theme"
          role="switch"
          aria-checked={isDark}
          aria-label={isDark ? '라이트 모드로 전환' : '다크 모드로 전환'}
          title={isDark ? '라이트 모드로 전환' : '다크 모드로 전환'}
          onClick={onToggleTheme}
        >
          <span className="toggle-icon toggle-sun" aria-hidden="true">
            <Sun size={12} strokeWidth={2.4} />
          </span>
          <span className="toggle-icon toggle-moon" aria-hidden="true">
            <Moon size={12} strokeWidth={2.4} />
          </span>
          <i className="toggle-thumb" aria-hidden="true" />
        </button>

        {/* 로그아웃 — 광고 인사이트와 로그인을 함께 쓰므로 그쪽도 함께 로그아웃된다 */}
        <Button
          className="icon top-logout"
          aria-label="로그아웃"
          title={user?.email ? `${user.email} 로그아웃` : '로그아웃'}
          onClick={() => void logout()}
          icon={<LogOut size={18} aria-hidden="true" />}
        />
      </div>
    </header>
  );
}
