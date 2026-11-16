import { useEffect, useState } from 'react';
import { usePageAnalysis } from '../hooks/usePageAnalysis';
import type { MonthData, NamesMap } from '../types/analytics';
import { fmt } from '../utils/format';
import { isGap } from '../utils/metrics';
import { EmptyState } from './EmptyState';
import { Card } from './Card';
import { Note } from './Note';
import { PageAnalysisResult } from './PageAnalysisResult';
import { PageAnalysisSkeleton } from './PageAnalysisSkeleton';
import { PageSearchCard } from './PageSearchCard';
import { SourceNotice, storeSource, type SourceLinkItem } from './SourceNotice';
import { TableWrap } from './TableWrap';

const pageSources = (siteUrl: string): SourceLinkItem[] => [
  { label: 'Google Analytics 4 API', href: 'https://analytics.google.com/' },
  storeSource(siteUrl),
  { label: 'URL·상품번호 실시간 검색 및 진입 세션별 전환율 집계 (10분 캐시)' },
];

interface PageAnalysisViewProps {
  /** 보고 있는 사이트의 쇼핑몰 주소 (출처 줄) */
  siteUrl: string;
  pageQ: string;
  pageM: string;
  keys: string[];
  months: Record<string, MonthData>;
  names: NamesMap;
  liveUrl: string;
  onOpenPage: (query: string, month?: string) => void;
  onChangeMonthOnly: (month: string) => void;
  onBackToDashboard?: () => void;
}

export function PageAnalysisView({
  siteUrl,
  pageQ,
  pageM,
  keys,
  months,
  names,
  liveUrl,
  onOpenPage,
  onChangeMonthOnly,
  onBackToDashboard,
}: PageAnalysisViewProps) {
  const [inputQ, setInputQ] = useState(pageQ);
  const { pageRes, pageBusy, fallbackSeries } = usePageAnalysis(
    pageQ,
    pageM,
    liveUrl,
    keys,
    months,
  );

  useEffect(() => {
    setInputQ(pageQ);
  }, [pageQ]);

  const validMonths = keys
    .slice()
    .reverse()
    .filter((k) => !isGap(months[k]));
  const latestMonth = months[keys[keys.length - 1]] || ({} as MonthData);
  const topPages = (latestMonth.pages || []).slice(0, 8).map((p) => p.pagePath);
  const topGoods = (latestMonth.goods || [])
    .slice(0, 5)
    .map(
      (g) =>
        [
          g.id,
          (names && names.goods && names.goods[g.id]) || `상품 #${g.id}`,
        ] as const,
    );

  let bodyContent: React.ReactNode = null;
  if (!pageQ) {
    bodyContent = (
      <Card className="card-empty" id="sectionPageEmpty">
        <EmptyState>
          위에서 페이지를 고르거나 주소·상품번호를 입력해 조회하세요.
        </EmptyState>
      </Card>
    );
  } else if (pageBusy || !pageRes) {
    bodyContent = <PageAnalysisSkeleton query={pageQ} />;
  } else if (pageRes.offline || pageRes.error) {
    const why = pageRes.offline
      ? '이 화면에는 수집기 주소가 없어 실시간 조회를 할 수 없습니다(로컬 빌드). 저장된 상위 50개 페이지 데이터로만 보여 드립니다.'
      : pageRes.error;
    const has = fallbackSeries.some((r) => r.views != null);
    bodyContent = (
      <Card className="card-page-fallback" id="sectionPageFallback">
        <Note className="mb-sm">{why}</Note>
        {has ? (
          <TableWrap>
            <table>
              <thead>
                <tr>
                  <th>월</th>
                  <th className="n">조회수</th>
                  <th className="n">방문자</th>
                </tr>
              </thead>
              <tbody>
                {fallbackSeries
                  .filter((r) => r.ok)
                  .map((r) => (
                    <tr key={r.month}>
                      <td>{r.month}</td>
                      <td className="n">{fmt(r.views)}</td>
                      <td className="n">{fmt(r.users)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </TableWrap>
        ) : (
          <EmptyState>저장된 상위 페이지에 없는 주소입니다.</EmptyState>
        )}
      </Card>
    );
  } else {
    bodyContent = (
      <PageAnalysisResult
        result={pageRes}
        query={pageQ}
        fallbackMonth={pageM}
        variant="page"
        onOpenPage={onOpenPage}
      />
    );
  }

  return (
    <>
      <PageSearchCard
        inputQ={inputQ}
        pageM={pageM}
        validMonths={validMonths}
        topPages={topPages}
        topGoods={topGoods}
        onInputChange={setInputQ}
        onSubmit={(q, m) => onOpenPage(q, m)}
        onSelectQuickTag={(q) => onOpenPage(q, pageM)}
        onChangeMonth={(nextM) => {
          if (pageQ) {
            onOpenPage(pageQ, nextM);
          } else {
            onChangeMonthOnly(nextM);
          }
        }}
        onBackToDashboard={onBackToDashboard}
      />

      {bodyContent}

      <SourceNotice sources={pageSources(siteUrl)} />
    </>
  );
}
