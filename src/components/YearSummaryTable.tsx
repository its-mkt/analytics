import type {
  GodomallQuotes,
  GodomallSignups,
  MetricKey,
  MonthData,
} from '../types/analytics';
import { fmt } from '../utils/format';
import { isGap, metricOf, okM, tracksEstimate } from '../utils/metrics';
import { CardHeader } from './CardHeader';
import { TableFoot } from './TableFoot';
import { TableWrap } from './TableWrap';

interface YearSummaryTableProps {
  year: string;
  ks: string[];
  months: Record<string, MonthData>;
  godoSignups: GodomallSignups | null;
  godoQuotes?: GodomallQuotes | null;
  onSelectMonth: (monthKey: string) => void;
}

const TABLE_METRICS: MetricKey[] = [
  'activeUsers',
  'sessions',
  'screenPageViews',
  'newUsers',
  'signups',
];

export function YearSummaryTable({
  ks,
  months,
  godoSignups,
  godoQuotes,
  onSelectMonth,
}: YearSummaryTableProps) {
  const val = (k: string, key: MetricKey) =>
    months[k] ? metricOf(months[k], key) : 0;
  const sum = (key: MetricKey) => ks.reduce((a, k) => a + val(k, key), 0);
  const showEst = tracksEstimate(ks.map((k) => months[k]));   // 온코어는 견적 열이 없다
  // 회원가입: 고도몰 실건수가 있으면 그 값(KPI 누계와 같은 기준), 없으면 GA4 가입 완료 이벤트
  const signupOf = (k: string) =>
    godoSignups && godoSignups.monthly[k] != null ? godoSignups.monthly[k] : val(k, 'signups');
  const signupSum = ks.reduce((a, k) => a + signupOf(k), 0);
  const quoteSum = ks.reduce((a, k) => {
    if (godoQuotes && godoQuotes.monthly[k] != null) return a + godoQuotes.monthly[k];
    const m = okM(months, k);
    return a + (m?.conv?.total?.estimate?.sessions || 0);
  }, 0);

  return (
    <section
      className="card card-year-summary"
      id="sectionYearSummary"
      aria-labelledby="headingYearSummary"
    >
      <CardHeader
        id="headingYearSummary"
        title="월별 요약"
        sub="행을 누르면 해당 월 상세 분석으로 이동"
      />

      <TableWrap>
        <table className="stk">
          <thead>
            <tr>
              <th className="th-month">월</th>
              <th className="n th-stat">방문자(일 합)</th>
              <th className="n th-stat">세션</th>
              <th className="n th-stat">페이지뷰</th>
              <th className="n th-stat">신규 방문자</th>
              <th className="n th-stat">회원가입</th>
              {showEst && <th className="n th-stat">견적요청</th>}
            </tr>
          </thead>
          <tbody>
            {ks.map((k, i) => {
              const m = okM(months, k);
              const gap = isGap(months[k]);
              const godoVal =
                godoSignups && godoSignups.monthly[k] != null
                  ? `${godoSignups.monthly[k]}*`
                  : '―';
              const godoEstVal =
                godoQuotes && godoQuotes.monthly[k] != null
                  ? `${godoQuotes.monthly[k]}*`
                  : m?.conv?.total?.estimate?.sessions != null
                    ? `${m.conv.total.estimate.sessions}`
                    : '―';
              return (
                <tr
                  key={k}
                  className={m ? 'link' : 'na'}
                  onClick={m ? () => onSelectMonth(k) : undefined}
                >
                  <td>
                    {i + 1}월
                    {m && m.partial && <span className="muted"> (진행 중)</span>}
                  </td>
                  {gap ? (
                    <>
                      <td
                        className="td-notice muted"
                        colSpan={4}
                        title="해당 기간은 방문 데이터가 집계되지 않은 기간입니다 (회원가입·견적 실적은 정상 집계)"
                      >
                        방문 데이터 미집계 기간
                      </td>
                      <td
                        className="n"
                        title="고도몰 회원가입 실건수 (회원 DB · 관리자 통계 중 큰 값)"
                      >
                        {godoVal}
                      </td>
                      {showEst && (
                        <td
                          className="n"
                          title="고도몰 DB 견적 실접수 건수 (참고용)"
                        >
                          {godoEstVal}
                        </td>
                      )}
                    </>
                  ) : m ? (
                    <>
                      {TABLE_METRICS.map((key) =>
                        key === 'signups' && godoSignups && godoSignups.monthly[k] != null ? (
                          <td key={key} className="n" title="고도몰 회원가입 실건수">
                            {godoVal}
                          </td>
                        ) : (
                          <td key={key} className="n">
                            {fmt(metricOf(m, key))}
                          </td>
                        ),
                      )}
                      {showEst && (
                        <td className="n" title="고도몰 DB 견적 실접수 건수">
                          {godoEstVal}
                        </td>
                      )}
                    </>
                  ) : (
                    <td className="td-notice muted" colSpan={showEst ? 6 : 5}>
                      ―
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="tr-total">
              <td className="td-month td-total-label">
                <span className="total-label">합계</span>
              </td>
              <td className="n td-stat td-total-val">
                <b>{fmt(sum('activeUsers'))}</b>
              </td>
              {(['sessions', 'screenPageViews', 'newUsers'] as MetricKey[]).map(
                (key) => (
                  <td key={key} className="n td-stat td-total-val">
                    <b>{fmt(sum(key))}</b>
                  </td>
                ),
              )}
              <td className="n td-stat td-total-val">
                <b>{fmt(signupSum)}{godoSignups ? '*' : ''}</b>
              </td>
              {showEst && (
                <td className="n td-stat td-total-val">
                  <b>{fmt(quoteSum)}*</b>
                </td>
              )}
            </tr>
          </tfoot>
        </table>
      </TableWrap>
      <TableFoot unit="단위: 명·회·건">
        <b>방문자</b> 일별 합산 · <b>세션·PV·신규</b> GA4 기준 · {showEst ? <><b>회원가입·견적요청</b> (*고도몰 DB 실접수)</> : <><b>회원가입</b> 가입 완료 화면 기준</>}
      </TableFoot>
    </section>
  );
}
