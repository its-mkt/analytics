/** 최근 검색어 — 이 브라우저에만 남는 편의 기능 (ad-insight 와 같은 방식, 저장 키만 다르다) */
const KEY = 'ana_recent_search';
const MAX_RECENT = 8;

function readList(): string[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(list) ? list.filter((q): q is string => typeof q === 'string') : [];
  } catch {
    return [];
  }
}

function writeList(list: string[]): string[] {
  try {
    if (list.length) localStorage.setItem(KEY, JSON.stringify(list));
    else localStorage.removeItem(KEY);
  } catch {
    // 저장이 막힌 환경에서는 기록 없이 동작한다
  }
  return list;
}

/** 대소문자만 다르면 같은 검색어로 본다 */
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

export const loadRecentSearches = (): string[] => readList().slice(0, MAX_RECENT);

/** 맨 앞에 넣는다. 대소문자만 다른 같은 검색어는 하나로 합친다 */
export const addRecentSearch = (query: string): string[] =>
  writeList([query, ...loadRecentSearches().filter((q) => !same(q, query))].slice(0, MAX_RECENT));

export const removeRecentSearch = (query: string): string[] =>
  writeList(loadRecentSearches().filter((q) => !same(q, query)));

export const clearRecentSearches = (): string[] => writeList([]);
