import { useEffect, useState, type ReactNode } from 'react';
import { Check, CheckSquare, Download, FileSpreadsheet, Square } from 'lucide-react';
import type { DashboardPayload } from '../types/analytics';
import { exportFilteredExcel, type ExportFilterOptions } from '../utils/exportExcel';
import { monthLabel, periodLabel } from '../utils/format';
import { Button } from './Button';
import { CloseButton } from './CloseButton';
import { Dropdown } from './Dropdown';

type PeriodMode = 'current' | 'month' | 'year';
type SheetKey = keyof ExportFilterOptions['sheets'];

const SHEET_ITEMS: Array<{ key: SheetKey; name: string; desc: string }> = [
  { key: 'kpi', name: '핵심 지표 요약', desc: '방문자, 신규 방문자, 세션, PV, 가입, 체류시간 요약' },
  { key: 'daily', name: '일별 상세 추이', desc: '날짜별 6대 지표 1일 단위 전수 데이터' },
  { key: 'conv', name: '유입 매체 및 전환 분석', desc: '소스별 방문수 및 견적·가입·주문 전환수/전환율' },
  { key: 'pages', name: '인기 페이지 TOP 50', desc: '경로별 조회수, 방문자, 체류시간 및 상품명' },
  { key: 'goods', name: '고도몰 인기 상품 TOP 50', desc: '쇼핑몰 URL 기준 상품별 조회수 및 순위' },
];

interface PeriodOptionProps {
  mode: PeriodMode;
  title: string;
  checked: boolean;
  onSelect: (mode: PeriodMode) => void;
  children: ReactNode;
}

/** 기간 선택 라디오 카드 */
function PeriodOption({ mode, title, checked, onSelect, children }: PeriodOptionProps) {
  return (
    <label className={`period-card ${checked ? 'active' : ''}`}>
      <input
        type="radio"
        name="periodMode"
        value={mode}
        checked={checked}
        onChange={() => onSelect(mode)}
      />
      <div className="period-card-head">
        <span className={`radio-dot ${checked ? 'checked' : ''}`} />
        <span className="period-title">{title}</span>
      </div>
      {children}
    </label>
  );
}

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: DashboardPayload;
  currentSel: string;
  keys: string[];
  years: string[];
}

export function ExportModal({
  isOpen,
  onClose,
  data,
  currentSel,
  keys,
  years,
}: ExportModalProps) {
  const latestMonth = keys[keys.length - 1] || '2026-10';
  const initialMonth = /^\d{4}-\d{2}$/.test(currentSel) ? currentSel : latestMonth;
  const initialYear = currentSel.slice(0, 4) || years[years.length - 1] || '2026';

  const [periodMode, setPeriodMode] = useState<PeriodMode>('current');
  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  const [selectedYear, setSelectedYear] = useState(initialYear);
  const [isExporting, setIsExporting] = useState(false);

  const [sheets, setSheets] = useState({
    kpi: true,
    daily: true,
    conv: true,
    pages: true,
    goods: true,
  });

  useEffect(() => {
    if (isOpen) {
      if (/^\d{4}$/.test(currentSel)) {
        setPeriodMode('year');
        setSelectedYear(currentSel);
      } else {
        setPeriodMode('current');
        setSelectedMonth(currentSel);
      }
    }
  }, [isOpen, currentSel]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const allSelected = Object.values(sheets).every(Boolean);
  const toggleAll = () => {
    setSheets({
      kpi: !allSelected,
      daily: !allSelected,
      conv: !allSelected,
      pages: !allSelected,
      goods: !allSelected,
    });
  };

  const selectedCount = Object.values(sheets).filter(Boolean).length;

  const handleDownload = async () => {
    let targetPeriod = '';
    if (periodMode === 'current') {
      targetPeriod = currentSel;
    } else if (periodMode === 'month') {
      targetPeriod = selectedMonth;
    } else {
      targetPeriod = selectedYear;
    }

    const options: ExportFilterOptions = {
      period: targetPeriod,
      sheets,
    };

    try {
      setIsExporting(true);
      await exportFilteredExcel(data, options);
    } finally {
      setIsExporting(false);
      onClose();
    }
  };

  const getPeriodLabel = () => {
    const k =
      periodMode === 'current'
        ? currentSel
        : periodMode === 'month'
          ? selectedMonth
          : selectedYear;
    return /^\d{4}$/.test(k) ? `${k}년 연간 누적` : monthLabel(k);
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className="modal-box export-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="exportModalTitle"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title-wrap">
            <div className="modal-icon">
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <h2 id="exportModalTitle">데이터 엑셀 내보내기</h2>
              <p className="modal-sub">
                원하는 기간과 데이터 항목을 선택하여 맞춤 엑셀(.xlsx)을 다운로드합니다
              </p>
            </div>
          </div>
          <CloseButton className="btn-modal-close" label="닫기" onClick={onClose} />
        </div>

        <div className="modal-body">
          {/* 1. 기간 선택 */}
          <div className="modal-section">
            <label className="modal-section-label">1. 기간 선택</label>
            <div className="period-options">
              <PeriodOption
                mode="current"
                title="현재 보고 있는 화면"
                checked={periodMode === 'current'}
                onSelect={setPeriodMode}
              >
                <div className="period-control-box period-badge-box">
                  {periodLabel(currentSel)}
                </div>
              </PeriodOption>

              <PeriodOption
                mode="month"
                title="특정 월 선택"
                checked={periodMode === 'month'}
                onSelect={setPeriodMode}
              >
                <Dropdown
                  className="period-control-box"
                  ariaLabel="내보낼 월"
                  value={selectedMonth}
                  disabled={periodMode !== 'month'}
                  options={keys
                    .slice()
                    .reverse()
                    .map((k) => ({ value: k, label: monthLabel(k) }))}
                  onChange={(val) => {
                    setSelectedMonth(val);
                    setPeriodMode('month');
                  }}
                />
              </PeriodOption>

              <PeriodOption
                mode="year"
                title="연간 전체 요약"
                checked={periodMode === 'year'}
                onSelect={setPeriodMode}
              >
                <Dropdown
                  className="period-control-box"
                  ariaLabel="내보낼 연도"
                  value={selectedYear}
                  disabled={periodMode !== 'year'}
                  options={years
                    .slice()
                    .reverse()
                    .map((y) => ({
                      value: y,
                      label: `${y}년 전체`,
                    }))}
                  onChange={(val) => {
                    setSelectedYear(val);
                    setPeriodMode('year');
                  }}
                />
              </PeriodOption>
            </div>
          </div>

          {/* 2. 데이터 시트 선택 */}
          <div className="modal-section">
            <div className="section-head-row">
              <label className="modal-section-label">2. 포함할 데이터 항목</label>
              <button
                type="button"
                className="btn-text-toggle"
                onClick={toggleAll}
              >
                {allSelected ? (
                  <>
                    <Square size={13} />
                    <span>전체 해제</span>
                  </>
                ) : (
                  <>
                    <CheckSquare size={13} />
                    <span>전체 선택</span>
                  </>
                )}
              </button>
            </div>

            <div className="sheet-checklist">
              {SHEET_ITEMS.map(({ key, name, desc }) => (
                <label key={key} className="sheet-item">
                  <input
                    type="checkbox"
                    checked={sheets[key]}
                    onChange={(e) => setSheets({ ...sheets, [key]: e.target.checked })}
                  />
                  <span className={`custom-checkbox ${sheets[key] ? 'checked' : ''}`}>
                    {sheets[key] && <Check size={12} strokeWidth={3} />}
                  </span>
                  <span className="sheet-info">
                    <b className="sheet-name">{name}</b>
                    <span className="sheet-desc">{desc}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <div className="footer-summary">
            선택된 기간: <b>{getPeriodLabel()}</b> ({selectedCount}개 시트)
          </div>
          <div className="footer-acts">
            <Button className="btn-modal-cancel" onClick={onClose}>
              취소
            </Button>
            <Button
              variant="primary"
              className="btn-modal-download"
              disabled={selectedCount === 0 || isExporting}
              onClick={handleDownload}
              icon={<Download size={14} />}
            >
              {isExporting ? '다운로드 생성 중...' : '엑셀 다운로드 (.xlsx)'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
