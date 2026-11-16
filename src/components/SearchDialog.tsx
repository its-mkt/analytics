import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { ArrowRight, Clock, Search, X } from 'lucide-react';
import type { MonthData, NamesMap } from '../types/analytics';
import { monthLabel } from '../utils/format';
import { addRecentSearch, clearRecentSearches, loadRecentSearches, removeRecentSearch } from '../utils/recentSearches';
import { searchAnalytics, type SearchAction } from '../utils/search';
import { CloseButton } from './CloseButton';

interface SearchDialogProps {
  /** 찾을 달 (YYYY-MM) — 보고 있는 달, 연간 화면이면 그 해 마지막 달 */
  monthKey: string;
  month?: MonthData;
  names: NamesMap;
  onClose: () => void;
  /** 결과를 고르거나 Enter — 검색어는 최근 검색어로 남긴다 */
  onPick: (action: SearchAction, month: string) => void;
}

/**
 * 헤더 검색 — ad-insight 의 검색 창과 같은 모양 · 같은 조작.
 * 입력하는 동안 그 달의 페이지 · 상품 · 카테고리 · 게시판 · 유입 경로를 묶음별로 보여 주고,
 * ↑↓ 로 고르고 Enter 로 연다. 고른 줄이 없으면 Enter 는 입력한 글자로 URL 분석을 연다. 바탕을 누르거나 Esc 로 닫는다.
 */
export function SearchDialog({ monthKey, month, names, onClose, onPick }: SearchDialogProps) {
  const [query, setQuery] = useState('');
  const [recents, setRecents] = useState(loadRecentSearches);
  const [active, setActive] = useState(-1);
  const deferred = useDeferredValue(query.trim());
  const groups = useMemo(() => searchAnalytics(month, names, deferred), [month, names, deferred]);
  const flat = useMemo(() => groups.flatMap((g) => g.rows), [groups]);
  const q = query.trim();

  useEffect(() => setActive(-1), [deferred]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !e.defaultPrevented && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // 열려 있는 동안 바탕 스크롤을 막는다
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const pick = (action: SearchAction) => {
    if (q) addRecentSearch(q);
    onPick(action, monthKey);
  };

  const onInputKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && flat.length) {
      e.preventDefault();
      setActive((i) => (i + 1) % flat.length);
    } else if (e.key === 'ArrowUp' && flat.length) {
      e.preventDefault();
      setActive((i) => (i <= 0 ? flat.length - 1 : i - 1));
    }
  };

  let idx = -1;

  return (
    <div className="search-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="card search-dialog" role="dialog" aria-modal="true" aria-label="검색" id="searchDialog">
        <form
          className="sd-form"
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            if (active >= 0 && flat[active]) pick(flat[active].action);
            else if (q) pick({ kind: 'page', query: q });
          }}
        >
          <Search size={18} aria-hidden="true" />
          <input
            className="sd-input"
            id="searchInput"
            type="search"
            placeholder="페이지 경로, 상품명, 카테고리, 게시판, 유입 매체 · 캠페인 검색"
            aria-label="검색어"
            aria-activedescendant={active >= 0 ? `sd-row-${active}` : undefined}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKey}
            autoFocus
            autoComplete="off"
          />
          <CloseButton className="sd-close btn-search-close" label="닫기" size={16} onClick={onClose} />
        </form>

        <div className="sd-results">
          {!q ? (
            recents.length ? (
              <section className="sd-group sd-recent" id="sd-recents">
                <h3>
                  최근 검색어
                  <button type="button" className="sd-recent-clear" onClick={() => setRecents(clearRecentSearches())}>
                    모두 지우기
                  </button>
                </h3>
                {recents.map((r) => (
                  <div className="sd-recent-row" key={r}>
                    <button type="button" className="sd-row btn-search-recent" onClick={() => setQuery(r)}>
                      <Clock size={14} aria-hidden="true" />
                      <span className="sd-name">{r}</span>
                    </button>
                    <button
                      type="button"
                      className="sd-recent-del"
                      aria-label={`최근 검색어에서 ${r} 지우기`}
                      onClick={() => setRecents(removeRecentSearch(r))}
                    >
                      <X size={14} aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </section>
            ) : (
              <p className="sd-hint">
                {monthLabel(monthKey)} 데이터에서 찾습니다. 예) <code>estimate</code> · 상품명 · <code>naver</code> · 캠페인 이름
              </p>
            )
          ) : !groups.length ? (
            <p className="sd-hint">
              {monthLabel(monthKey)}에 &quot;{q}&quot;와 일치하는 결과가 없습니다. Enter를 누르면 URL 분석에서 이 글자가 들어간 주소를 모두 찾습니다.
            </p>
          ) : (
            groups.map((g) => (
              <section className="sd-group" key={g.id}>
                <h3>
                  {g.title} <span>{g.total.toLocaleString('ko-KR')}</span>
                </h3>
                {g.rows.map((r) => {
                  idx += 1;
                  const i = idx;
                  return (
                    <button
                      type="button"
                      key={r.key}
                      id={`sd-row-${i}`}
                      className={`sd-row btn-search-row${i === active ? ' on' : ''}`}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => pick(r.action)}
                    >
                      <span className="sd-name">
                        {r.name}
                        {r.sub && <small className="sd-sub">{r.sub}</small>}
                      </span>
                      <span className="sd-meta">{r.meta}</span>
                    </button>
                  );
                })}
              </section>
            ))
          )}
        </div>

        {q && (
          <button type="button" className="sd-more btn-search-submit" onClick={() => pick({ kind: 'page', query: q })}>
            URL 분석에서 &quot;{q}&quot; 들어간 주소 모두 보기 <ArrowRight size={14} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}
