import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { PageAnalysisResult } from '../types/analytics';
import { fmt, pct } from '../utils/format';
import { ProgressBar } from './ProgressBar';
import { TableFoot } from './TableFoot';
import { TableWrap } from './TableWrap';

interface DetailCardProps {
  /** id 접미사 (cardPage{name} / headingPage{name}) */
  name: string;
  /** 카드 클래스 접미사 (card-page-{cls}) */
  cls: string;
  title: string;
  isEmpty: boolean;
  empty?: ReactNode;
  children: ReactNode;
}

/** 페이지 분석 하단의 제목 + 표 카드 */
function DetailCard({ name, cls, title, isEmpty, empty, children }: DetailCardProps) {
  return (
    <section
      className={`card card-page-${cls}`}
      id={`cardPage${name}`}
      aria-labelledby={`headingPage${name}`}
    >
      <h2 id={`headingPage${name}`}>{title}</h2>
      <TableWrap isEmpty={isEmpty} empty={empty}>
        {children}
      </TableWrap>
    </section>
  );
}

interface PageAnalysisDetailsProps {
  result: PageAnalysisResult;
  currentMonth: string;
  query: string;
  onOpenPage: (query: string, month?: string) => void;
}

export function PageAnalysisDetails({
  result: r,
  currentMonth,
  query,
  onOpenPage,
}: PageAnalysisDetailsProps) {
  const mrows = (r.monthly || []).slice(-14).reverse();
  const mmx = Math.max(1, ...(mrows || []).map((x) => x.screenPageViews));
  const sources = r.sources || [];
  const devices = r.devices || [];
  const urls = r.urls || [];
  const events = r.events || [];
  const smax = Math.max(1, ...sources.map((x) => x.sessions));
  const en = r.entry || { sessions: 0, conv: {}, byMedium: {} };

  return (
    <>
      <div className="grid">
        <DetailCard name="Monthly" cls="monthly" title="월별 추이" isEmpty={mrows.length === 0}>
          <table>
            <thead>
              <tr>
                <th>월 (누르면 이동)</th>
                <th className="n">조회수</th>
                <th className="n">방문자</th>
              </tr>
            </thead>
            <tbody>
              {mrows.map((x) => {
                const isCur = x.month === currentMonth;
                return (
                  <tr
                    key={x.month}
                    className={isCur ? '' : 'go'}
                    onClick={
                      isCur ? undefined : () => onOpenPage(query, x.month)
                    }
                  >
                    <td>
                      {x.month}
                      {isCur && (
                        <>
                          {' '}
                          <ArrowLeft size={12} aria-label="현재 월" />
                        </>
                      )}
                      <ProgressBar value={x.screenPageViews} max={mmx} />
                    </td>
                    <td className="n">{fmt(x.screenPageViews)}</td>
                    <td className="n">{fmt(x.activeUsers)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </DetailCard>

        <DetailCard name="Sources" cls="sources" title="유입 매체" isEmpty={sources.length === 0}>
          <table>
            <thead>
              <tr>
                <th>유입 매체</th>
                <th className="n">세션</th>
                <th className="n">조회수</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((x) => (
                <tr key={x.sessionSourceMedium}>
                  <td>
                    <span className="tx" title={x.sessionSourceMedium}>
                      {x.sessionSourceMedium}
                    </span>
                    <ProgressBar value={x.sessions} max={smax} />
                  </td>
                  <td className="n">{fmt(x.sessions)}</td>
                  <td className="n">{fmt(x.screenPageViews)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DetailCard>
      </div>

      <div className="grid">
        <DetailCard
          name="Conversions"
          cls="conversions"
          title="전환 (이 페이지로 시작한 방문)"
          isEmpty={!(en.sessions > 0)}
          empty="이 페이지로 처음 들어온 방문이 없어 전환율을 계산할 수 없습니다 (다른 페이지에서 넘어온 조회만 있음)."
        >
          <table>
            <thead>
              <tr>
                <th>전환</th>
                <th className="n">전환 세션</th>
                <th className="n">전환율</th>
                <th className="hm">많이 전환한 유입</th>
              </tr>
            </thead>
            <tbody>
              {(r.defs || []).map((d) => {
                const s = en.conv[d.id] || 0;
                const meds = (en.byMedium[d.id] || [])
                  .slice(0, 3)
                  .map((x) => `${x.k} ${fmt(x.s)}`)
                  .join(' · ');
                return (
                  <tr key={d.id}>
                    <td>{d.name}</td>
                    <td className="n">{fmt(s)}</td>
                    <td className="n rate">{pct(s, en.sessions)}</td>
                    <td className="hm muted">{meds || '―'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <TableFoot unit="단위: 세션·%">
            첫 랜딩 방문({fmt(en.sessions)}회) 기준 전환 도달 세션 및 전환율 (GA4)
          </TableFoot>
        </DetailCard>

        <DetailCard name="Devices" cls="devices" title="기기" isEmpty={devices.length === 0}>
          <table>
            <thead>
              <tr>
                <th>기기</th>
                <th className="n">방문자</th>
                <th className="n">조회수</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((x) => (
                <tr key={x.deviceCategory}>
                  <td>{x.deviceCategory}</td>
                  <td className="n">{fmt(x.activeUsers)}</td>
                  <td className="n">{fmt(x.screenPageViews)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DetailCard>
      </div>

      <div className="grid">
        <DetailCard name="Urls" cls="urls" title="합쳐진 주소 (상위 15)" isEmpty={urls.length === 0}>
          <table>
            <thead>
              <tr>
                <th>주소(쿼리 포함)</th>
                <th className="n">조회수</th>
                <th className="n">방문자</th>
              </tr>
            </thead>
            <tbody>
              {urls.map((x) => (
                <tr key={x.pagePathPlusQueryString}>
                  <td>
                    <span className="tx" title={x.pagePathPlusQueryString}>
                      {x.pagePathPlusQueryString}
                    </span>
                  </td>
                  <td className="n">{fmt(x.screenPageViews)}</td>
                  <td className="n">{fmt(x.activeUsers)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DetailCard>

        <DetailCard
          name="Events"
          cls="events"
          title="이 페이지에서 발생한 이벤트"
          isEmpty={events.length === 0}
        >
          <table>
            <thead>
              <tr>
                <th>이벤트</th>
                <th className="n">횟수</th>
              </tr>
            </thead>
            <tbody>
              {events.map((x) => (
                <tr key={x.eventName}>
                  <td>{x.eventName}</td>
                  <td className="n">{fmt(x.eventCount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DetailCard>
      </div>
    </>
  );
}
