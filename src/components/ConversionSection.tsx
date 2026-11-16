import { useMemo } from 'react';
import type {
  ConvByKey,
  ConversionDef,
  GodomallQuotes,
  GodomallSignups,
  MonthData,
  NamesMap,
} from '../types/analytics';
import { fmt, pct } from '../utils/format';
import { CONV_BY, godoCount } from '../utils/metrics';
import { CardHeader } from './CardHeader';
import { Card } from './Card';
import { KpiCardsGrid } from './KpiCardsGrid';
import { ProgressBar } from './ProgressBar';
import { SegmentedControl } from './SegmentedControl';
import { TableFoot } from './TableFoot';
import { TableWrap } from './TableWrap';

interface ConversionSectionProps {
  monthData: MonthData;
  prevMonthData?: MonthData;
  /** 실건수(고도몰 DB)를 비교할 전월 — GA4 비교가 빠진 달이어도 실건수는 비교한다 */
  prevKey?: string;
  names: NamesMap;
  godoSignups?: GodomallSignups | null;
  godoQuotes?: GodomallQuotes | null;
  godoQuotesLoading?: boolean;
  convBy: ConvByKey;
  onChangeConvBy: (by: ConvByKey) => void;
  onOpenPage: (query: string) => void;
}

interface IntegratedRow {
  k: string;
  n: number;
  u?: number;
  convs: Record<string, number>;
  totalConv: number;
}

function getDefShortName(d: ConversionDef): string {
  if (d.id === 'estimate') return '견적 요청';
  if (d.id === 'signup') return '회원가입';
  if (d.id === 'order') return '주문';
  return d.name.replace(/\s*완료\s*$/, '') || d.name;
}

function buildConversionRows(
  monthData: MonthData,
  convBy: ConvByKey,
  defs: ConversionDef[],
): IntegratedRow[] {
  const c = monthData.conv;
  if (!c) return [];

  // 1. 유입 매체
  if (convBy === 'byMedium') {
    const maps: Record<string, Map<string, number>> = {};
    for (const d of defs) {
      maps[d.id] = new Map((c.byMedium?.[d.id] || []).map((r) => [r.k, r.s]));
    }
    return (monthData.sources || []).slice(0, 15).map((x) => {
      const convs: Record<string, number> = {};
      let totalConv = 0;
      for (const d of defs) {
        const s = maps[d.id]?.get(x.sessionSourceMedium) || 0;
        convs[d.id] = s;
        totalConv += s;
      }
      return {
        k: x.sessionSourceMedium,
        n: x.sessions,
        u: x.activeUsers,
        convs,
        totalConv,
      };
    });
  }

  // 2. 채널
  if (convBy === 'byChannel') {
    const maps: Record<string, Map<string, number>> = {};
    for (const d of defs) {
      maps[d.id] = new Map((c.byChannel?.[d.id] || []).map((r) => [r.k, r.s]));
    }
    return (monthData.channels || []).slice(0, 15).map((x) => {
      const convs: Record<string, number> = {};
      let totalConv = 0;
      for (const d of defs) {
        const s = maps[d.id]?.get(x.sessionDefaultChannelGroup) || 0;
        convs[d.id] = s;
        totalConv += s;
      }
      return {
        k: x.sessionDefaultChannelGroup,
        n: x.sessions,
        u: x.activeUsers,
        convs,
        totalConv,
      };
    });
  }

  // 3. 이벤트 기반 집계 (랜딩, 상품, 캠페인)
  const map = new Map<string, { k: string; n: number; convs: Record<string, number> }>();
  for (const d of defs) {
    const rows = c[convBy]?.[d.id] || [];
    for (const r of rows) {
      if (!map.has(r.k)) {
        map.set(r.k, { k: r.k, n: r.n, convs: {} });
      }
      const item = map.get(r.k)!;
      item.convs[d.id] = r.s;
      if (r.n > item.n) item.n = r.n;
    }
  }

  const merged = Array.from(map.values()).map((r) => {
    let totalConv = 0;
    for (const d of defs) {
      totalConv += r.convs[d.id] || 0;
    }
    return {
      k: r.k,
      n: r.n,
      convs: r.convs,
      totalConv,
    };
  });

  merged.sort((a, b) => b.totalConv - a.totalConv || b.n - a.n);
  return merged.slice(0, 15);
}

const FALLBACK_DEFS: ConversionDef[] = [
  { id: 'estimate', name: '견적 요청', path: '/dbk/dbk_estimate_complete.php' },
  { id: 'signup', name: '회원가입 완료', path: '/member/join_ok.php' },
  { id: 'order', name: '주문 완료', path: '/order/order_end.php' },
];

export function ConversionSection({
  monthData,
  prevMonthData,
  prevKey: prevK,
  names,
  godoSignups,
  godoQuotes,
  godoQuotesLoading,
  convBy,
  onChangeConvBy,
  onOpenPage,
}: ConversionSectionProps) {
  const c = monthData.conv;
  const defs = c?.defs || FALLBACK_DEFS;
  const isSourceBased = convBy === 'byMedium' || convBy === 'byChannel';
  const rows = useMemo(
    () => (c ? buildConversionRows(monthData, convBy, defs) : []),
    [monthData, convBy, defs, c],
  );

  const mx = useMemo(
    () => Math.max(1, ...rows.map((r) => (isSourceBased ? r.n : r.totalConv))),
    [rows, isSourceBased],
  );
  const clickable = convBy === 'byLanding' || convBy === 'byGoods';
  const colHeader = CONV_BY.find((x) => x[0] === convBy)?.[1] || '';

  const renderRowName = (r: IntegratedRow) => {
    if (convBy === 'byCampaign') {
      const [camp, md] = r.k.split(' | ');
      return (
        <>
          {camp} <span className="muted">· {md || ''}</span>
        </>
      );
    }
    if (convBy === 'byGoods') {
      const gName =
        (names && names.goods && names.goods[r.k]) || `상품 #${r.k}`;
      return (
        <>
          {gName} <span className="muted">#{r.k}</span>
        </>
      );
    }
    return r.k;
  };

  const getRowQuery = (r: IntegratedRow) =>
    convBy === 'byGoods'
      ? `goodsNo=${r.k}`
      : convBy === 'byLanding'
        ? r.k
        : '';

  return (
    <>
      <KpiCardsGrid
        id="kpisConversion"
        ariaLabel="전환 목표별 지표"
        items={defs.map((d) => {
          const t = c?.total?.[d.id] || { sessions: 0, users: 0 };
          const isEstimate = d.id === 'estimate';
          const isSignup = d.id === 'signup';

          const godoEst = isEstimate ? godoCount(godoQuotes, monthData.month, null) : null;
          // 진행 중인 달도 전월 전체와 비교한다 (KPI 공통 기준, 사용자 결정 2026-11-16)
          const prevGodoEst = isEstimate
            ? godoCount(godoQuotes, prevK ?? prevMonthData?.month, null)
            : null;

          const godoSign = isSignup ? godoCount(godoSignups, monthData.month, null) : null;
          const prevGodoSign = isSignup
            ? godoCount(godoSignups, prevK ?? prevMonthData?.month, null)
            : null;

          const isLoading = !!godoQuotesLoading;
          const actualCount = isEstimate ? godoEst : isSignup ? godoSign : null;
          const prevActualCount = isEstimate ? prevGodoEst : isSignup ? prevGodoSign : null;

          const cur = actualCount != null ? actualCount : t.sessions;
          const pv =
            actualCount != null
              ? prevActualCount
              : prevMonthData && prevMonthData.conv
                ? (prevMonthData.conv.total[d.id] || {}).sessions
                : null;

          const cats =
            isEstimate && godoQuotes && godoQuotes.byCategory
              ? godoQuotes.byCategory[monthData.month]
              : null;

          const name = getDefShortName(d);
          // 실데이터(시트·회원 DB)가 있는 지표인데 연동이 실패하면 GA4 완료화면 세션으로 대신하고 아래 줄에 기준을 적는다
          // 실데이터가 연동되는 사이트(아이티켓)에서 그 연동이 실패했을 때만 '대체값'이다 — 온코어 가입은 원래 GA4 기준
          const fallback = actualCount == null && (isEstimate || (isSignup && godoSignups != null));
          // 모든 카드에 아래 줄: 견적은 카테고리, 나머지는 전환율(완료 화면을 본 세션 ÷ 전체 세션)
          const rate: [string, string] = ['전환율', pct(t.sessions, monthData.total.sessions)];
          const detail: Array<[string, string | number]> =
            isEstimate && !fallback && cats
              ? Object.entries(cats).sort((a, b) => b[1] - a[1]).slice(0, 3)
              : fallback
                ? [['기준', 'GA4 완료화면'], rate]
                : [rate];

          return {
            label: `${+monthData.month.slice(5)}월 ${name}${monthData.partial ? ' (진행 중)' : ''}`,
            value: cur,
            unit: '건',
            loading: isLoading,
            cur,
            prev: pv ?? null,
            cmpLabel: '전월',
            detail,
            title: `${actualCount != null
              ? (isEstimate ? '견적문의 시트 실접수 기준' : '고도몰 회원 DB 가입일 기준')
              : 'GA4 완료화면을 본 세션 기준'} · 전환율은 GA4 완료화면을 본 세션 ÷ 전체 세션`,
          };
        })}
      />

      {/* 실데이터(시트·회원 DB) 안내 — 아이티켓만 연동돼 있어 온코어에서는 두지 않는다 */}
      {(godoQuotes || godoSignups) && (
      <p className="conv-note">
        견적 요청은 고도몰 견적문의 시트(접수날짜 열), 회원가입은 고도몰 회원 DB(가입일) 기준이며 15분 캐시로 조회합니다.
        연동이 실패하면 GA4 완료화면 세션(가입은 마지막 저장된 월 합계)을 대신 보여 주고, 그때는 카드 아래 줄에 "기준 GA4 완료화면"이 표시됩니다.
      </p>
      )}

      <Card
        className="card-conversion"
        id="sectionConversion"
        labelledBy="headingConversion"
      >
        <CardHeader
          id="headingConversion"
          title="전환 분석"
          sub="(유입 경로별 추적은 GA4 웹 세션 기준)"
          actions={
            <SegmentedControl
              items={CONV_BY}
              value={convBy}
              onChange={onChangeConvBy}
            />
          }
        />

        <TableWrap
          isEmpty={rows.length === 0}
          empty={
            !c
              ? '이 달은 GA4 유입 경로별 세션 전환 수집(2026년 8월 도입) 이전 기간입니다. 상단 고도몰 DB 실접수 건수를 참고해 주세요.'
              : '이 기준으로 집계된 전환이 없습니다.'
          }
          emptyStyle={{ padding: '2.5rem 1rem', textAlign: 'center' }}
        >
          <table>
            <thead>
              <tr>
                <th className="th-entity">{colHeader}</th>
                <th className="num th-stat th-traffic">세션</th>
                {isSourceBased && <th className="num hide-mobile th-stat th-traffic">방문자</th>}
                {defs.map((d) => (
                  <th
                    key={d.id}
                    className="num th-stat th-conv"
                    title={`${d.name} (${d.path})`}
                  >
                    {getDefShortName(d)}
                  </th>
                ))}
                <th className="num th-stat th-conv-total">전체 전환</th>
                <th className="num th-stat th-rate">전환율</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const q = getRowQuery(r);
                const barVal = isSourceBased ? r.n : r.totalConv;
                return (
                  <tr
                    key={r.k}
                    className={clickable ? 'link' : ''}
                    onClick={clickable && q ? () => onOpenPage(q) : undefined}
                  >
                    <td className="td-entity">
                      <span className="cell-text" title={r.k}>
                        {renderRowName(r)}
                      </span>
                      <ProgressBar value={barVal} max={mx} />
                    </td>
                    <td className="num td-stat th-traffic">{fmt(r.n)}</td>
                    {isSourceBased && (
                      <td className="num hide-mobile td-stat th-traffic">
                        {r.u != null ? fmt(r.u) : '-'}
                      </td>
                    )}
                    {defs.map((d) => {
                      const val = r.convs[d.id] || 0;
                      return (
                        <td key={d.id} className="num td-stat th-conv">
                          {val > 0 ? (
                            <span className="conv-num active">{fmt(val)}</span>
                          ) : (
                            <span className="conv-num zero">0</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="num td-stat th-conv-total">
                      {r.totalConv > 0 ? (
                        <span className="conv-total-pill">{fmt(r.totalConv)}</span>
                      ) : (
                        <span className="conv-num zero">0</span>
                      )}
                    </td>
                    <td className="num td-stat th-rate rate">
                      {r.totalConv > 0 ? (
                        <span className="rate-badge">{pct(r.totalConv, r.n)}</span>
                      ) : (
                        <span className="rate-zero">0.0%</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableWrap>

        <TableFoot unit="단위: 세션·%">
          <b>전환</b> 목표 화면 도달 세션(견적·가입·주문) ·{' '}
          <b>전환율</b> 전환 세션 ÷ 전체 세션 · <b>랜딩·상품</b> 첫 진입 기준
          {clickable ? ' · 행 클릭 시 상세 분석 이동' : ''}
        </TableFoot>
      </Card>
    </>
  );
}
