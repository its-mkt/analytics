import type { ConvByKey, MonthData, NamesMap, ShopItem } from '../types/analytics';

/**
 * 헤더 검색 — 보고 있는 달의 데이터에서 페이지 · 상품 · 카테고리 · 게시판 · 유입 경로를 찾는다.
 * 상품 · 카테고리 · 게시판은 그 달 상위 목록에 없어도 이름표(names)로 찾는다 (조회수는 '―').
 */

/** 결과를 눌렀을 때 할 일 — URL 분석으로 열거나, 전환 분석의 해당 표로 간다 */
export type SearchAction = { kind: 'page'; query: string } | { kind: 'conv'; by: ConvByKey };

export interface SearchRow {
  key: string;
  name: string;
  /** 보조 표기 — 경로·번호 */
  sub?: string;
  /** 오른쪽 수치 — 조회수·세션 */
  meta: string;
  action: SearchAction;
}

export interface SearchGroup {
  id: 'pages' | 'goods' | 'categories' | 'boards' | 'sources' | 'campaigns';
  title: string;
  total: number;
  rows: SearchRow[];
}

const LIMIT = 5;
const n = (v: number) => v.toLocaleString('ko-KR');

/** 대소문자 · 띄어쓰기 차이는 무시한다 */
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '');

function shopGroup(
  id: 'goods' | 'categories' | 'boards',
  title: string,
  items: ShopItem[] | undefined,
  names: Record<string, string> | undefined,
  param: string,
  q: string,
): SearchGroup {
  const seen = new Map<string, { id: string; title: string; views: number | null }>();
  (items || []).forEach((r) => {
    const t = r.title || names?.[r.id] || '';
    seen.set(r.id, { id: r.id, title: t, views: r.views });
  });
  Object.entries(names || {}).forEach(([k, t]) => {
    if (!seen.has(k)) seen.set(k, { id: k, title: t, views: null });
  });
  const hits = [...seen.values()]
    .filter((r) => norm(r.title).includes(q) || r.id === q.replace(/^\D+/, ''))
    .sort((a, b) => (b.views ?? -1) - (a.views ?? -1));
  return {
    id,
    title,
    total: hits.length,
    rows: hits.slice(0, LIMIT).map((r) => ({
      key: `${id}-${r.id}`,
      name: r.title || `#${r.id}`,
      sub: `${param}=${r.id}`,
      meta: r.views != null ? `조회 ${n(r.views)}` : '이 달 상위 밖',
      action: { kind: 'page', query: `${param}=${r.id}` },
    })),
  };
}

export function searchAnalytics(m: MonthData | undefined, names: NamesMap, query: string): SearchGroup[] {
  const q = norm(query);
  if (!q) return [];
  const groups: SearchGroup[] = [];

  const pages = (m?.pages || []).filter((p) => norm(p.pagePath).includes(q));
  groups.push({
    id: 'pages',
    title: '페이지',
    total: pages.length,
    rows: pages.slice(0, LIMIT).map((p) => ({
      key: `page-${p.pagePath}`,
      name: p.pagePath,
      meta: `조회 ${n(p.screenPageViews)}`,
      action: { kind: 'page', query: p.pagePath },
    })),
  });

  groups.push(shopGroup('goods', '상품', m?.goods, names.goods, 'goodsNo', q));
  groups.push(shopGroup('categories', '카테고리', m?.categories, names.categories, 'cateCd', q));
  groups.push(shopGroup('boards', '게시판', m?.boards, names.boards, 'bdId', q));

  const sources = (m?.sources || []).filter((s) => norm(s.sessionSourceMedium).includes(q));
  groups.push({
    id: 'sources',
    title: '유입 매체',
    total: sources.length,
    rows: sources.slice(0, LIMIT).map((s) => ({
      key: `src-${s.sessionSourceMedium}`,
      name: s.sessionSourceMedium,
      meta: `세션 ${n(s.sessions)}`,
      action: { kind: 'conv', by: 'byMedium' },
    })),
  });

  const campaigns = (m?.campaigns || []).filter(
    (c) => norm(c.sessionCampaignName).includes(q) && c.sessionCampaignName !== '(not set)',
  );
  groups.push({
    id: 'campaigns',
    title: '캠페인',
    total: campaigns.length,
    rows: campaigns.slice(0, LIMIT).map((c) => ({
      key: `cmp-${c.sessionCampaignName}-${c.sessionSourceMedium}`,
      name: c.sessionCampaignName,
      sub: c.sessionSourceMedium,
      meta: `세션 ${n(c.sessions)}`,
      action: { kind: 'conv', by: 'byCampaign' },
    })),
  });

  return groups.filter((g) => g.total > 0);
}
