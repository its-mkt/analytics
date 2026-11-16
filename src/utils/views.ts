import type { ViewTab } from '../types/analytics';

/** 화면 이름 — 사이드바 메뉴 · 헤더 경로 · 화면 머리말이 같은 이름을 쓴다 (ad-insight VIEW_TITLES 와 같은 방식) */
export const VIEW_TITLES: Record<ViewTab, string> = {
  overview: '종합 요약',
  conversion: '전환 분석',
  content: '페이지 · 상품',
  page: 'URL 분석',
};

/** 화면 머리말 아래 한 줄 설명 */
export const VIEW_DESC: Record<ViewTab, string> = {
  overview: '방문 · 유입 · 전환 흐름을 한눈에 파악하는 월간 GA4 대시보드',
  conversion: '전환 완료 화면을 본 방문이 어떤 유입 매체 · 랜딩 페이지에서 오는지 분석',
  content: '많이 본 페이지와 고도몰 상품 · 카테고리 · 게시판 순위',
  page: '경로 · 주소 일부 · 상품번호로 페이지 성과를 GA4 에서 바로 조회',
};

/** 연도를 고르면 탭과 상관없이 연간 화면이 열린다 */
export const YEAR_TITLE = '연간 요약';
export const yearDesc = (year: string) => `${year}년 월별 방문 · 전환 성과를 모아 보는 연간 리포트`;
