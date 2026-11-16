import { useEffect } from 'react';
import { ExternalLink } from 'lucide-react';
import { usePageAnalysis } from '../hooks/usePageAnalysis';
import type { MonthData, NamesMap } from '../types/analytics';
import { resolvePageTitle } from '../utils/pageAnalysis';
import { Button } from './Button';
import { CloseButton } from './CloseButton';
import { PageAnalysisResult } from './PageAnalysisResult';
import { PageAnalysisSkeleton } from './PageAnalysisSkeleton';

interface PageDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  pageQ: string;
  pageM: string;
  keys: string[];
  months: Record<string, MonthData>;
  names: NamesMap;
  liveUrl: string;
  onOpenFullPage?: (q: string, m?: string) => void;
}

export function PageDrawer({
  isOpen,
  onClose,
  pageQ,
  pageM,
  keys,
  months,
  names,
  liveUrl,
  onOpenFullPage,
}: PageDrawerProps) {
  const { pageRes, pageBusy } = usePageAnalysis(
    isOpen ? pageQ : '',
    pageM,
    liveUrl,
    keys,
    months,
  );

  // ESC 키로 닫기
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // 배경 스크롤 방지
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('drawer-open-lock');
    } else {
      document.body.classList.remove('drawer-open-lock');
    }
    return () => {
      document.body.classList.remove('drawer-open-lock');
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const { title, sub } = resolvePageTitle(pageQ, names);

  return (
    <div className="page-drawer-portal" role="dialog" aria-modal="true">
      <div
        className="page-drawer-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="page-drawer-container">
        {/* 드로어 헤더 */}
        <div className="drawer-header">
          <div className="drawer-title-group">
            <span className="drawer-badge">상세 성과 분석</span>
            <h3 className="drawer-title" title={title}>
              {title}
            </h3>
            {sub && <span className="drawer-sub">{sub}</span>}
          </div>

          <div className="drawer-actions">
            {onOpenFullPage && (
              <Button
                variant="ghost"
                className="btn-drawer-ext"
                title="전체 페이지 분석 화면으로 이동"
                onClick={() => {
                  onClose();
                  onOpenFullPage(pageQ, pageM);
                }}
                icon={<ExternalLink size={15} />}
              >
                전체 화면
              </Button>
            )}
            <CloseButton
              className="btn btn-icon btn-drawer-close"
              label="서랍 닫기"
              onClick={onClose}
            />
          </div>
        </div>

        {/* 드로어 본문 콘텐츠 */}
        <div className="drawer-content">
          {/* 조회 중이거나 첫 결과가 오기 전(창이 막 열린 순간)은 같은 로딩 모양 */}
          {pageBusy || !pageRes ? (
            <PageAnalysisSkeleton query={pageQ} />
          ) : (
            <PageAnalysisResult
              result={pageRes}
              query={pageQ}
              fallbackMonth={pageM}
              variant="drawer"
              onOpenPage={(q, m) => {
                if (onOpenFullPage) {
                  onClose();
                  onOpenFullPage(q, m);
                }
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
