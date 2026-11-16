import React from 'react';
import { MonthPicker } from './MonthPicker';

interface PeriodNavProps {
  years: string[];
  selectedPeriod: string;
  minAvailableMonth?: string;
  maxAvailableMonth: string;
  onSelectPeriod: (period: string) => void;
  /** 기간 선택 옆 한 줄 안내 (예: 진행 중인 달의 집계 기준) — ad-insight 기간 줄과 같은 자리 */
  note?: string;
}

export const PeriodNav: React.FC<PeriodNavProps> = ({
  years,
  selectedPeriod,
  minAvailableMonth,
  maxAvailableMonth,
  onSelectPeriod,
  note,
}) => {
  const minYear = [...years].sort()[0] || maxAvailableMonth.slice(0, 4);

  return (
    <div className="period-nav-bar" id="periodNav">
      <div className="period-nav-left">
        <MonthPicker
          value={selectedPeriod}
          min={minAvailableMonth || `${minYear}-01`}
          max={maxAvailableMonth}
          onChange={onSelectPeriod}
        />
        {note && <span className="period-nav-note">{note}</span>}
      </div>
    </div>
  );
};
