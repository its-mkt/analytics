import type { ReactNode } from 'react';
import { Skeleton } from './Skeleton';

interface LivePanelSkeletonProps {
  /** 실시간 패널이 접힌 상태인지 — 기본은 접힘. 로딩 전후로 모양·높이가 같도록 그 상태의 틀로 그린다 */
  collapsed?: boolean;
  /** 접힌 줄 오른쪽 '자세히 보기' 버튼 (로딩 중에도 펼칠 수 있다) */
  toggle?: ReactNode;
}

export function LivePanelSkeleton({ collapsed = false, toggle }: LivePanelSkeletonProps) {
  if (collapsed) {
    // 실제 접힌 줄과 같은 틀(.live.live-collapsed) — 숫자·기기 정보 자리만 스켈레톤
    return (
      <div id="liveBox">
        <div className="live live-collapsed" id="livePanel" aria-busy="true" aria-label="실시간 접속 불러오는 중">
          <div className="live-collapsed-content">
            <span className="dot off" />
            <span className="live-collapsed-label">실시간 접속</span>
            <Skeleton className="skel-live-collapsed-val" />
            <Skeleton className="skel-live-collapsed-sub" />
          </div>
          {toggle}
        </div>
      </div>
    );
  }

  return (
    <div id="liveBox">
      <div className="skel-live">
        <div className="skel-live-summary">
          <div className="skel-live-title-row">
            <Skeleton className="skel-dot" circle />
            <Skeleton className="skel-title-text" />
          </div>
          <Skeleton className="skel-live-count" />
          <Skeleton className="skel-live-sub" />
          <Skeleton className="skel-live-bar" />
        </div>

        <div className="skel-live-pages-wrap">
          <Skeleton className="skel-pages-title" />
          <div className="skel-pages-list">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skel-page-row">
                <Skeleton
                  className="skel-page-name"
                  style={{ width: `${60 + (i % 3) * 15}%` }}
                />
                <Skeleton className="skel-page-count" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
