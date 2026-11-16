import { useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, ChevronUp } from 'lucide-react';
import { useLivePolling } from '../hooks/useLivePolling';
import { agoText, computeOdometer, fmt } from '../utils/format';
import { LivePanelSkeleton } from './LivePanelSkeleton';

interface LivePanelProps {
  liveUrl: string;
}

const DEVICE_LABELS: Record<string, string> = {
  desktop: 'PC',
  mobile: '모바일',
  tablet: '태블릿',
};

/** 실시간 접속자 증감 칩 */
function DeltaChip({ d }: { d: number }) {
  return (
    <span className={`chip ${d > 0 ? 'up' : 'down'}`}>
      {d > 0 ? (
        <>
          <ArrowUp size={12} aria-hidden="true" /> +
        </>
      ) : (
        <>
          <ArrowDown size={12} aria-hidden="true" />{' '}
        </>
      )}
      {d}
    </span>
  );
}

interface LiveNoticeProps {
  title: string;
  msg: string;
  hint?: string;
}

/** 실시간 데이터가 없을 때(일시정지·연결 대기)의 안내 패널 */
function LiveNotice({ title, msg, hint }: LiveNoticeProps) {
  return (
    <div id="liveBox">
      <div className="live">
        <div>
          <div className="label live-head">
            <span className="dot off" />
            {title}
          </div>
          <div className="num msg">{msg}</div>
          {hint && <div className="label">{hint}</div>}
        </div>
      </div>
    </div>
  );
}

export function LivePanel({ liveUrl }: LivePanelProps) {
  const { live, err, paused, rollFrom, deltaInfo, nowMs } =
    useLivePolling(liveUrl);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      const saved = localStorage.getItem('itket_live_collapsed');
      return saved !== 'false';
    } catch {
      return true;
    }
  });

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('itket_live_collapsed', String(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  if (!liveUrl) {
    return <div id="liveBox" />;
  }

  if (paused) {
    return (
      <LiveNotice
        title="실시간 일시정지"
        msg="오래 사용하지 않아 갱신을 멈췄습니다"
        hint="화면을 누르거나 움직이면 다시 시작합니다"
      />
    );
  }

  if (!live) {
    if (err) {
      return (
        <LiveNotice title="실시간" msg="연결 대기 중…" />
      );
    }
    return <LivePanelSkeleton />;
  }

  const dev = (live.devices || [])
    .map(
      (r) =>
        `${DEVICE_LABELS[r.deviceCategory] || r.deviceCategory} ${fmt(r.activeUsers)}`,
    )
    .join(' · ');

  const ago = Math.max(
    0,
    Math.round((nowMs - new Date(live.at).getTime()) / 1000),
  );
  const showDelta = deltaInfo && deltaInfo.until > nowMs;
  const odoDigits =
    rollFrom != null ? computeOdometer(rollFrom, live.activeUsers) : null;

  if (collapsed) {
    return (
      <div id="liveBox">
        <div className="live live-collapsed" id="livePanel">
          <div className="live-collapsed-content">
            <span className={`dot${live.stale ? ' off' : ''}`} />
            <span className="live-collapsed-label">실시간 접속</span>
            <b className="live-collapsed-val">{fmt(live.activeUsers)}명</b>
            {showDelta && (
              <DeltaChip d={deltaInfo.d} />
            )}
            <span className="live-collapsed-sub">
              ({dev || '집계 중'} · {agoText(ago)})
            </span>
          </div>
          <LiveToggle open={false} onClick={toggleCollapsed} />
        </div>
      </div>
    );
  }

  return (
    <div id="liveBox">
      <section className="live" id="livePanel" aria-label="실시간 접속 현황">
        <div className="live-stat" id="liveStatBox">
          <div className="label live-head">
            <span className={`dot${live.stale ? ' off' : ''}`} />
            지금 접속 중 (최근 30분)
          </div>
          <div className="num">
            {odoDigits
              ? odoDigits.map((d, idx) =>
                  d.same ? (
                    <span key={idx}>{d.newChar}</span>
                  ) : (
                    <span
                      key={idx}
                      className={`roll ${d.dir}${d.gone ? ' gone' : ''}`}
                    >
                      <i aria-hidden="true">{d.oldChar}</i>
                      <b>{d.newChar}</b>
                    </span>
                  ),
                )
              : fmt(live.activeUsers)}
            명
            {showDelta && (
              <DeltaChip d={deltaInfo.d} />
            )}
          </div>
          <div className="label">
            {dev || '\u00a0'} ·{' '}
            <time id="liveAgo" data-at={live.at} dateTime={live.at}>
              {agoText(ago)}
            </time>{' '}
            갱신{live.stale ? ' · 조회 한도로 지연(최근 성공값)' : ''}
          </div>
        </div>

        <div className="live-pages" id="livePagesBox">
          {/* 머리줄: 제목 … 접기 버튼 (접힌 줄의 '자세히 보기'와 같은 오른쪽 끝) */}
          <div className="label live-head live-head-row">
            <span>지금 보는 페이지</span>
            <LiveToggle open onClick={toggleCollapsed} />
          </div>
          <ul>
            {(live.pages || []).length > 0 ? (
              (live.pages || []).slice(0, 5).map((r, idx) => (
                <li key={idx}>
                  <span title={r.unifiedScreenName}>
                    {r.unifiedScreenName || '(제목 없음)'}
                  </span>
                  <span>{fmt(r.activeUsers)}명</span>
                </li>
              ))
            ) : (
              <li>
                <span className="muted">지금 보는 페이지 없음</span>
              </li>
            )}
          </ul>
        </div>
      </section>
    </div>
  );
}

/** 실시간 상자 펼치기/접기 버튼 — 접힌 줄 오른쪽 끝에서는 '자세히 보기', 펼친 상자에서는 '지금 보는 페이지' 머리줄 오른쪽 끝의 '접기' */
function LiveToggle({ open, onClick }: { open: boolean; onClick: () => void }) {
  const label = open ? '실시간 패널 접기' : '실시간 접속 현황 자세히 보기';
  return (
    <button
      type="button"
      className="btn-live-toggle"
      onClick={onClick}
      aria-label={label}
      aria-expanded={open}
      title={label}
    >
      <span>{open ? '접기' : '자세히 보기'}</span>
      {open ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
    </button>
  );
}
