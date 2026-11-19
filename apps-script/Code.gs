/**
 * itket-analytics 수집기 v2 (Google Apps Script)
 *
 * GA4 → 월별 JSON(드라이브 파일) + 실시간 현황을 웹앱 주소(doGet)로 내려준다.
 *  - collectRecent : 30분마다, 당월만 새로 수집 (대시보드가 2분마다 가져감). 계정 공용 트리거 실행 시간(하루 90분)을 아끼려고 15분에서 늘림
 *  - collectAll    : 3시간마다, 당월·전월 갱신 + 빠진/구버전 과거 월 채움
 *  - ?mode=live    : GA4 Realtime API (지금 접속자·지금 보는 페이지), 20초 캐시
 *  - ?mode=cur     : 당월 + 전월 JSON (가벼움)
 *  - (기본)        : 전체 월 JSON
 * 서비스 계정·JSON 키 불필요 — 이 스크립트를 만든 구글 계정의 GA4 권한으로 읽는다.
 * 처음 설정은 저장소 README 의 "처음 한 번만" 참고. 코드를 고치면 "배포 관리 → 새 버전"으로 다시 배포.
 */
// 견적 요청 실접수 집계용 스프레드시트 (견적문의 시트)
const QUOTES_SHEET_ID = '18tMYBQLuIhkmX_x_c8MK-aNXlGvOgz1TWauvqo8Dmjg';
// 회원가입 실데이터: 아이티켓 서버 조회 API(가입일별 건수만, 개인정보 없음). 키는 스크립트 속성 ITKET_SYNC_KEY
const SIGNUPS_API_URL = 'https://www.itket.com/dbk/dbk_member_stats.php';

const CFG = {
  PROPERTY_ID: '257396991',   // GA4 관리 → 속성 설정 → 속성 ID
  START_MONTH: '2025-01',
  SIGNUP_EVENT: 'sign_up',
  JOIN_DONE_PATH: '/member/join_ok.php',     // 회원가입 완료 화면 — 사이트가 sign_up 이벤트를 보내지 않을 때의 대체 기준
  TOP_ROWS: 50,
  FILE_NAME: 'itket-analytics-data.json',
  FILE_ID: '116fOOcfj-jNeYEKuj_2vbAkhUAHBnbNR', // 수집본 파일. 새로 만들면 이 값을 바꾼다
  SHEET_ID: '1m2nYgwjzaAU5kGKaByzZEKwHrim3lyUK07B84-IBwBg', // 사람이 보는 시트 (itket-analytics 데이터)
  SHEET_MONTHLY: '월별 요약',
  SHEET_DAILY: '일별',
  BUDGET_MS: 4.5 * 60 * 1000,                // 한 번 실행에 쓸 최대 시간(6분 제한 대비)
  SCHEMA: 4,                                 // 수집 항목이 바뀌면 올린다 → 과거 월을 다시 채움 (3: 전환·이벤트·랜딩 추가, 4: 기기별 유입·전환)
  MEASUREMENT_ID: 'G-EJ5SHHZPND',            // 참고용(데이터 스트림 식별). 수집에는 PROPERTY_ID 를 쓴다
  // 전환 정의: 이 화면(경로)을 본 세션을 "전환"으로 센다. 사이트가 전환 이벤트를 보내지 않아 화면 기준으로 센다.
  // 바꾸려면 여기만 고치고 SCHEMA 숫자를 올린다. path 는 정확히 일치해야 한다.
  CONVERSIONS: [
    { id: 'estimate', name: '견적 요청 완료', path: '/dbk/dbk_estimate_complete.php' },
    { id: 'signup', name: '회원가입 완료', path: '/member/join_ok.php' },
    { id: 'order', name: '주문 완료', path: '/order/order_end.php' },
  ],
  PAGE_MAX_PER_10MIN: 40,                    // 페이지 분석(?mode=page) 새 조회 한도 — 남용·한도 소진 방지
  PAGE_CACHE_SEC: 600,                       // 페이지 분석 결과 캐시(당월). 지난 달은 1시간
  LIVE_CACHE_SEC: 30,                        // ① 접속자 수 갱신 간격(실측 34토큰/회) — 남은 한도가 충분할 때
  LIVE_COOLDOWN_SEC: 300,                    // 한도 오류 직후 API 재호출을 쉬는 시간
  LIVE_MID_SEC: 180,                         // ② 지금 보는 페이지 + 분당 그래프(2회 약 70토큰) 기본 간격
  LIVE_SLOW_SEC: 600,                        // ③ 기기 구분(1회) 기본 간격
  LIVE_BUDGET: [[9000, 30], [6500, 60], [4000, 120], [2000, 300]],   // [남은 시간당 토큰이 이 값 초과, ①의 간격(초)] — ②③은 ①의 6배·20배 이상으로 함께 늘어남
  LIVE_BUDGET_MIN_TTL: 900,                  // 남은 토큰이 2,500 이하일 때
  SHOP_REFRESH_MIN: 120,                     // 인기 상품·카테고리·게시판(무거운 조회)은 이 간격으로만 새로 계산
};
let LAST_QUOTA_ = null;                      // 마지막 API 응답의 한도 사용량(진단용)
const M = ['activeUsers', 'newUsers', 'sessions', 'screenPageViews', 'userEngagementDuration', 'engagedSessions'];

/* 사이트 전환 — 수집·실시간·페이지 분석 함수는 지금 사이트(SITE_)의 GA4 속성·전환 정의로 조회한다.
 * null = 아이티켓(CFG), ONCORE = 온코어. withSite_ 로 감싸 잠깐 바꾸고 끝나면 되돌린다. */
let SITE_ = null;
function site_() { return SITE_ || CFG; }
function withSite_(site, fn) {
  const prev = SITE_;
  SITE_ = site === 'oncore' ? ONCORE : null;
  try { return fn(); } finally { SITE_ = prev; }
}
// 캐시 키 앞머리 — 사이트마다 실시간·페이지 분석 캐시를 따로 둔다 (아이티켓은 예전 키 그대로)
function ck_(k) { return SITE_ ? 'oc:' + k : k; }

function todayKst_() { return Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd'); }
function lastDay_(m) { const [y, mo] = m.split('-').map(Number); return Utilities.formatDate(new Date(Date.UTC(y, mo, 0)), 'UTC', 'yyyy-MM-dd'); }
function addMonth_(m, n) { const [y, mo] = m.split('-').map(Number); return Utilities.formatDate(new Date(Date.UTC(y, mo - 1 + n, 1)), 'UTC', 'yyyy-MM'); }
function ymd_(s) { return s.slice(0, 4) + '-' + s.slice(4, 6) + '-' + s.slice(6); }

function rows_(resp) {
  const dh = (resp.dimensionHeaders || []).map((h) => h.name);
  const mh = (resp.metricHeaders || []).map((h) => h.name);
  return (resp.rows || []).map((r) => {
    const o = {};
    dh.forEach((n, i) => (o[n] = r.dimensionValues[i].value));
    mh.forEach((n, i) => (o[n] = Number(r.metricValues[i].value)));
    return o;
  });
}
function q_(dims, metrics, range, extra) {
  const req = Object.assign({
    dateRanges: [range],
    dimensions: dims.map((name) => ({ name })),
    metrics: metrics.map((name) => ({ name })),
    limit: 1000,
    returnPropertyQuota: true,
  }, extra || {});
  const resp = AnalyticsData.Properties.runReport(req, 'properties/' + site_().PROPERTY_ID);
  if (resp.propertyQuota) LAST_QUOTA_ = resp.propertyQuota;
  return rows_(resp);
}

/** 고도몰 URL 규칙으로 상품(goodsNo)·카테고리(cateCd)·게시판(bdId) 조회수를 집계한다. */
function shopStats_(range) {
  const contains = (v) => ({ filter: { fieldName: 'pagePath', stringFilter: { matchType: 'CONTAINS', value: v } } });
  const rows = q_(['pagePathPlusQueryString', 'pageTitle'], ['screenPageViews', 'activeUsers'], range, {
    dimensionFilter: { orGroup: { expressions: [contains('goods_view'), contains('goods_list'), contains('board/')] } },
    orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
    limit: 5000,
  });
  const acc = { goods: {}, categories: {}, boards: {} };
  const add = (bucket, id, r) => {
    const o = bucket[id] || (bucket[id] = { id: id, title: r.pageTitle, views: 0 });
    o.views += r.screenPageViews;
    if (!o.title || o.title === '(not set)') o.title = r.pageTitle;
  };
  rows.forEach((r) => {
    const u = r.pagePathPlusQueryString;
    let m;
    if (u.indexOf('goods_view') >= 0 && (m = u.match(/[?&]goodsNo=(\d+)/))) add(acc.goods, m[1], r);
    else if (u.indexOf('goods_list') >= 0 && (m = u.match(/[?&]cateCd=([0-9A-Za-z]+)/))) add(acc.categories, m[1], r);
    else if (u.indexOf('board/') >= 0 && (m = u.match(/[?&]bdId=([0-9A-Za-z_]+)/))) add(acc.boards, m[1], r);
  });
  const top = (b, n) => Object.keys(b).map((k) => b[k]).sort((a, c) => c.views - a.views).slice(0, n);
  return { goods: top(acc.goods, 100), categories: top(acc.categories, 100), boards: top(acc.boards, 30) };
}

/** 회원가입 수(일별). GA4 에 sign_up 이벤트가 있으면 그것을, 없으면 가입 완료 화면(join_ok)을 본 사용자 수를 쓴다.
 *  (이 사이트는 가입 완료 시 sign_up 이벤트를 보내지 않아 2025년부터 이벤트가 0건 — 2026-10-14 확인) */
function signupsOf_(range) {
  const ev = q_(['date'], ['eventCount'], range, {
    dimensionFilter: { filter: { fieldName: 'eventName', stringFilter: { matchType: 'EXACT', value: CFG.SIGNUP_EVENT } } },
  });
  if (ev.reduce((a, r) => a + r.eventCount, 0) > 0) return { source: 'event', rows: ev.map((r) => ({ date: ymd_(r.date), count: r.eventCount })) };
  const pv = q_(['date'], ['activeUsers'], range, {
    dimensionFilter: { filter: { fieldName: 'pagePath', stringFilter: { matchType: 'EXACT', value: CFG.JOIN_DONE_PATH } } },
  });
  return { source: 'join_ok', rows: pv.map((r) => ({ date: ymd_(r.date), count: r.activeUsers })) };
}

/** 선택 항목: 실패해도 월 수집 전체를 막지 않는다(한도 오류는 그대로 올려 다음에 재시도). */
function opt_(fn, fallback) {
  try { return fn(); }
  catch (e) { if (/Exhausted|quota/i.test(String((e && e.message) || e))) throw e; return fallback; }
}
const convPaths_ = () => site_().CONVERSIONS.map((d) => d.path);
const convFilter_ = () => ({ filter: { fieldName: 'pagePath', inListFilter: { values: convPaths_() } } });
const convIdOf_ = (path) => { const d = site_().CONVERSIONS.filter((x) => x.path === path)[0]; return d && d.id; };
const bySessions_ = { orderBys: [{ metric: { metricName: 'sessions' }, desc: true }], limit: 2000 };
/** 랜딩 URL → 묶음 키. 상품 상세는 상품번호로, 나머지는 경로로 묶는다. */
function landKey_(u) {
  u = String(u);
  const g = /[?&]goodsNo=(\d+)/.exec(u);
  if (g && u.indexOf('goods_view') >= 0) return 'goods:' + g[1];
  return u.split('?')[0];
}

/** 전환(정의된 화면을 본 세션) 집계: 전체·일별·유입 매체·채널·캠페인·랜딩 페이지·상품. n = 같은 키의 전체 세션(전환율 계산용). */
function convStats_(range) {
  const out = { defs: site_().CONVERSIONS.map((d) => ({ id: d.id, name: d.name, path: d.path })), total: {}, daily: {}, byMedium: {}, byChannel: {}, byCampaign: {}, byLanding: {}, byGoods: {}, byDevice: {}, byDeviceChannel: {} };
  const ids = site_().CONVERSIONS.map((d) => d.id);
  ids.forEach((id) => { out.total[id] = { sessions: 0, users: 0 }; out.daily[id] = []; ['byMedium', 'byChannel', 'byCampaign', 'byLanding', 'byGoods', 'byDevice', 'byDeviceChannel'].forEach((b) => (out[b][id] = [])); });
  const cf = convFilter_();
  q_(['pagePath'], ['sessions', 'activeUsers'], range, { dimensionFilter: cf }).forEach((r) => {
    const id = convIdOf_(r.pagePath); if (id) out.total[id] = { sessions: r.sessions, users: r.activeUsers };
  });
  q_(['date', 'pagePath'], ['sessions'], range, { dimensionFilter: cf, orderBys: [{ dimension: { dimensionName: 'date' } }] }).forEach((r) => {
    const id = convIdOf_(r.pagePath); if (id) out.daily[id].push({ date: ymd_(r.date), count: r.sessions });
  });
  const by = (bucket, dims) => {
    const key = (r) => dims.map((d) => r[d]).join(' | ');
    const base = {};
    q_(dims, ['sessions'], range, bySessions_).forEach((r) => (base[key(r)] = r.sessions));
    const acc = {};
    q_(['pagePath'].concat(dims), ['sessions'], range, Object.assign({ dimensionFilter: cf }, bySessions_)).forEach((r) => {
      const id = convIdOf_(r.pagePath); if (!id) return;
      (acc[id] = acc[id] || []).push({ k: key(r), s: r.sessions, n: base[key(r)] || 0 });
    });
    ids.forEach((id) => (out[bucket][id] = (acc[id] || []).slice(0, 30)));
  };
  by('byMedium', ['sessionSourceMedium']);
  by('byChannel', ['sessionDefaultChannelGroup']);
  by('byCampaign', ['sessionCampaignName', 'sessionSourceMedium']);
  // 기기별(desktop·mobile·tablet) 전환, 기기 × 채널 전환 — k 는 'mobile' · 'mobile | Paid Search'
  by('byDevice', ['deviceCategory']);
  by('byDeviceChannel', ['deviceCategory', 'sessionDefaultChannelGroup']);
  // 랜딩(첫 진입) 페이지 기준: 어느 페이지로 들어온 방문이 전환했는가. 상품 상세는 상품번호로 묶는다.
  const baseL = {};
  q_(['landingPagePlusQueryString'], ['sessions'], range, { orderBys: [{ metric: { metricName: 'sessions' }, desc: true }], limit: 5000 }).forEach((r) => {
    const k = landKey_(r.landingPagePlusQueryString); baseL[k] = (baseL[k] || 0) + r.sessions;
  });
  const accL = {};
  q_(['pagePath', 'landingPagePlusQueryString'], ['sessions'], range, { dimensionFilter: cf, orderBys: [{ metric: { metricName: 'sessions' }, desc: true }], limit: 5000 }).forEach((r) => {
    const id = convIdOf_(r.pagePath); if (!id) return;
    const k = landKey_(r.landingPagePlusQueryString), m = (accL[id] = accL[id] || {});
    m[k] = (m[k] || 0) + r.sessions;
  });
  ids.forEach((id) => {
    const rows = Object.keys(accL[id] || {}).map((k) => ({ k: k, s: accL[id][k], n: baseL[k] || 0 })).sort((a, b) => b.s - a.s);
    out.byGoods[id] = rows.filter((r) => r.k.indexOf('goods:') === 0).slice(0, 50).map((r) => ({ k: r.k.slice(6), s: r.s, n: r.n }));
    out.byLanding[id] = rows.filter((r) => r.k.indexOf('goods:') !== 0).slice(0, 30);
  });
  // 서버가 결제 주문마다 한 번 보내는 purchase 이벤트 (its-ad-insight sendGa4Purchases_). 전송 전에는 빈 값이다
  const pf = { filter: { fieldName: 'eventName', stringFilter: { matchType: 'EXACT', value: 'purchase' } } };
  out.purchase = opt_(() => ({
    daily: q_(['date'], ['eventCount'], range, { dimensionFilter: pf, orderBys: [{ dimension: { dimensionName: 'date' } }] }).map((r) => ({ date: ymd_(r.date), count: r.eventCount })),
    byMedium: q_(['sessionSourceMedium'], ['eventCount'], range, { dimensionFilter: pf, orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }], limit: 30 }).map((r) => ({ k: r.sessionSourceMedium, s: r.eventCount })),
  }), { daily: [], byMedium: [] });
  return out;
}

/** GA4 이커머스 이벤트(상품 노출·장바구니·구매)가 오는 경우만 값이 있다. */
function ecomStats_(range) {
  const rows = q_(['itemName'], ['itemsViewed', 'itemsAddedToCart', 'itemsPurchased', 'itemRevenue'], range, { orderBys: [{ metric: { metricName: 'itemsViewed' }, desc: true }], limit: 50 });
  return rows.filter((r) => r.itemName && r.itemName !== '(not set)').map((r) => ({ name: r.itemName, viewed: r.itemsViewed, cart: r.itemsAddedToCart, bought: r.itemsPurchased, revenue: r.itemRevenue }));
}

function collectMonth_(m, today, reuse) {
  const range = { startDate: m + '-01', endDate: m === today.slice(0, 7) ? today : lastDay_(m) };
  const top = (metric) => ({ orderBys: [{ metric: { metricName: metric }, desc: true }], limit: site_().TOP_ROWS });
  const total = q_([], M, range);
  const daily = q_(['date'], M, range, { orderBys: [{ dimension: { dimensionName: 'date' } }] });
  const pages = q_(['pagePath'], ['screenPageViews', 'activeUsers', 'userEngagementDuration'], range, top('screenPageViews'));
  const sources = q_(['sessionSourceMedium'], ['sessions', 'activeUsers', 'newUsers', 'engagedSessions'], range, top('sessions'));
  const channels = q_(['sessionDefaultChannelGroup'], ['sessions', 'activeUsers'], range, top('sessions'));
  const campaigns = q_(['sessionCampaignName', 'sessionSourceMedium'], ['sessions', 'activeUsers'], range, top('sessions'));
  const devices = q_(['deviceCategory'], ['activeUsers', 'sessions'], range, top('sessions'));
  // 기기 × 채널 유입 (세션·사용자·참여 세션). 기기 3종 × 채널 10여 개라 상위 제한 없이 모두 받는다
  const deviceChannels = q_(['deviceCategory', 'sessionDefaultChannelGroup'], ['sessions', 'activeUsers', 'engagedSessions'], range, { orderBys: [{ metric: { metricName: 'sessions' }, desc: true }], limit: 200 });
  const sg = signupsOf_(range);
  // 무거운 조회: 재사용 가능한 최근 값이 있으면 다시 계산하지 않는다
  const fresh = reuse && reuse.goods && reuse.shopUpdated && (Date.now() - Date.parse(reuse.shopUpdated) < CFG.SHOP_REFRESH_MIN * 60000);
  const shop = fresh ? { goods: reuse.goods, categories: reuse.categories, boards: reuse.boards } : shopStats_(range);
  const conv = opt_(() => convStats_(range), null);
  const events = opt_(() => {
    const ord = { orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }], limit: 40 };
    try { return q_(['eventName'], ['eventCount', 'totalUsers', 'keyEvents'], range, ord); }
    catch (e) { if (/Exhausted|quota/i.test(String(e && e.message || e))) throw e; return q_(['eventName'], ['eventCount', 'totalUsers'], range, ord); }
  }, []);
  const keyBySource = opt_(() => q_(['sessionSourceMedium'], ['sessions', 'keyEvents'], range, { orderBys: [{ metric: { metricName: 'keyEvents' }, desc: true }], limit: 30 }), []);
  const ecom = opt_(() => ecomStats_(range), []);
  const t = total[0] || {};
  const pick = (r) => { const o = {}; M.forEach((k) => (o[k] = r[k] || 0)); return o; };
  return {
    v: site_().SCHEMA,
    month: m,
    partial: m === today.slice(0, 7),
    updated: new Date().toISOString(),
    total: pick(t),
    daily: daily.map((r) => Object.assign({ date: ymd_(r.date) }, pick(r))),
    pages: pages, sources: sources, channels: channels,
    campaigns: campaigns.filter((r) => r.sessionCampaignName && r.sessionCampaignName !== '(not set)' && r.sessionCampaignName !== '(direct)'),
    devices: devices,
    deviceChannels: deviceChannels,               // 기기 × 기본 채널 그룹 유입 (SCHEMA 4 부터)
    signups: sg.rows, signupSource: sg.source,   // 'event' = GA4 sign_up 이벤트, 'join_ok' = 가입 완료 화면(일별 방문자) 기준
    conv: conv,                                   // 전환(정의된 화면 기준) — null 이면 이번 수집에서 실패
    events: events, keyBySource: keyBySource.filter((r) => r.keyEvents > 0), ecom: ecom,   // GA4 이벤트 현황 / GA4 주요 이벤트 기준 전환 / 이커머스 상품 지표
    goods: shop.goods, categories: shop.categories, boards: shop.boards,
    shopUpdated: fresh ? reuse.shopUpdated : new Date().toISOString(),
  };
}

// 파일 이름이 아니라 ID 로 연다. 같은 이름의 바로가기·사본이 있으면 이름 검색이 엉뚱한 항목을 잡기 때문이다.
function file_() { return DriveApp.getFileById(CFG.FILE_ID); }
// 파일을 못 열면 그대로 오류를 낸다. 빈 데이터로 넘어가면 다음 저장 때 기존 수집본을 덮어쓸 수 있다.
function load_() {
  const text = file_().getBlob().getDataAsString();
  if (!text.trim()) return { months: {} }; // 파일이 완전히 비었으면 되살릴 내용이 없으므로 GA4 에서 다시 채운다 (내용이 깨진 경우는 아래에서 오류)
  try { return JSON.parse(text); } catch (e) { throw new Error(CFG.FILE_NAME + ' 내용이 JSON 이 아닙니다: ' + e.message); }
}
function save_(store) { file_().setContent(JSON.stringify(store)); }

/** 사람이 보는 시트(월별 요약·일별)를 수집본으로 다시 쓴다. 표시용이라 실패해도 수집은 실패로 만들지 않는다. */
function writeSheet_(store) {
  try {
    const ss = SpreadsheetApp.openById(CFG.SHEET_ID);
    const put = (name, rows) => {
      const sh = ss.getSheetByName(name) || ss.insertSheet(name);
      const data = rows.map((r) => r.map((v) => (v === undefined || v === null ? '' : v)));
      const range = sh.getRange(1, 1, data.length, data[0].length);
      sh.getRange(1, 1, data.length, 1).setNumberFormat('@');   // 2025-01 이 날짜로 바뀌지 않게
      range.setValues(data);
      const extra = sh.getMaxRows() - data.length;
      if (extra > 0) sh.getRange(data.length + 1, 1, extra, sh.getMaxColumns()).clearContent();
      sh.setFrozenRows(1);
    };
    const num = (t) => [t.activeUsers, t.newUsers, t.sessions, t.screenPageViews, t.engagedSessions];
    const head = ['활성 사용자', '신규 사용자', '세션', '페이지뷰', '참여 세션'];
    const months = Object.keys(store.months).sort();
    put(CFG.SHEET_MONTHLY, [['월'].concat(head, ['진행 중', '수집 시각'])].concat(months.map((m) => {
      const x = store.months[m];
      return [m].concat(num(x.total || {}), [x.partial ? 'Y' : '', x.updated || '']);
    })));
    const days = [];
    months.forEach((m) => (store.months[m].daily || []).forEach((d) => days.push([d.date].concat(num(d)))));
    if (days.length) put(CFG.SHEET_DAILY, [['날짜'].concat(head)].concat(days));
    const old = ss.getSheetByName('시트1');
    if (old && ss.getSheets().length > 1) ss.deleteSheet(old);   // 처음 손으로 만든 사본 탭
  } catch (e) { console.warn('시트 기록 실패: ' + e.message); }
}
/** 수동 실행용: 지금 수집본으로 시트만 다시 쓴다. */
function syncSheet() { writeSheet_(load_()); }

function checkProperty_() {
  if (/[^0-9]/.test(CFG.PROPERTY_ID)) throw new Error('CFG.PROPERTY_ID 에 GA4 속성 ID(숫자)를 넣어 주세요.');
}

/** 30분마다: 당월만 새로 수집(빠름). */
function collectRecent() {
  checkProperty_();
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return;                       // 다른 수집이 돌고 있으면 건너뜀
  try {
    const today = todayKst_(), cur = today.slice(0, 7);
    const store = load_();
    try { store.months[cur] = collectMonth_(cur, today, store.months[cur]); }
    catch (e) { if (/Exhausted|quota/i.test(String((e && e.message) || e))) return; throw e; }   // 시간당 한도 소진은 조용히 건너뜀(다음 30분에 재시도)
    store.updated = new Date().toISOString();
    store.quota = LAST_QUOTA_ && { at: new Date().toISOString(), q: LAST_QUOTA_ };
    save_(store);
    writeSheet_(store);
  } finally { lock.releaseLock(); }
}

/** 3시간마다: 당월·전월은 항상 새로, 빠진/구버전 과거 월은 시간 되는 만큼 채운다. */
function collectAll() {
  checkProperty_();
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return;
  try {
    const started = Date.now();
    const today = todayKst_(), cur = today.slice(0, 7), prev = addMonth_(cur, -1);
    const store = load_();
    const all = [];
    for (let m = CFG.START_MONTH; m <= cur; m = addMonth_(m, 1)) all.push(m);
    const stale = (m) => !store.months[m] || store.months[m].v !== CFG.SCHEMA;
    const queue = [cur, prev].filter((m) => all.indexOf(m) >= 0).concat(all.filter((m) => m !== cur && m !== prev && stale(m)));
    const errors = [];
    for (const m of queue) {
      if (Date.now() - started > CFG.BUDGET_MS) break;    // 남은 달은 다음 실행에서 이어서
      try { store.months[m] = collectMonth_(m, today); store.updated = new Date().toISOString(); save_(store); }
      catch (e) { errors.push(m + ': ' + e.message); }
    }
    store.errors = errors;
    if (!errors.length) store.updated = new Date().toISOString();
    save_(store);
    writeSheet_(store);
    if (errors.length) throw new Error(errors.join('\n'));   // 실행 기록에 실패로 남김
  } finally { lock.releaseLock(); }
}

/** 한 번만 실행: 이미 저장된 과거 월의 회원가입 수를 새 기준(signupsOf_)으로 채운다. 호출 제한을 피하려고 월마다 잠깐 쉰다. */
function backfillSignups() {
  checkProperty_();
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return;
  try {
    const started = Date.now();
    const today = todayKst_();
    const store = load_();
    const keys = Object.keys(store.months).sort();
    let done = 0;
    for (const m of keys) {
      if (Date.now() - started > CFG.BUDGET_MS) break;
      const x = store.months[m];
      if (x.signupSource) continue;                       // 이미 새 기준
      if (x.total && x.total.sessions < 100) { x.signupSource = 'none'; continue; }   // 방문이 거의 없던 달은 건너뜀
      const range = { startDate: m + '-01', endDate: m === today.slice(0, 7) ? today : lastDay_(m) };
      const sg = signupsOf_(range);
      x.signups = sg.rows; x.signupSource = sg.source; done++;
      Utilities.sleep(1500);
    }
    save_(store);
    Logger.log('보정한 달: ' + done + ' / 전체 ' + keys.length + (Date.now() - started > CFG.BUDGET_MS ? ' (시간 초과 — 다시 실행하면 이어서 진행)' : ''));
  } finally { lock.releaseLock(); }
}

/** 실시간(최근 30분) — GA4 Realtime API, 3단 갱신 (호출 1건 ≈ 34~55토큰, 시간당 한도 14,000)
 *  ① 접속자 수 1회: 30초 — 화면에서 가장 중요한 숫자
 *  ② 지금 보는 페이지 + 분당 그래프 2회: 3분
 *  ③ 기기 구분 1회: 10분
 *  남은 토큰이 줄면 ①②③ 간격을 함께 늘리고, 한도 오류가 나면 5분 쉬면서 마지막 성공 값을 stale 로 돌려준다. */
function liveNow_() {
  const cache = CacheService.getScriptCache();
  if (cache.get(ck_('liveCool'))) return staleLive_('조회 한도 회복 대기 중');
  const part = (k) => { const v = cache.get(ck_(k)); return v ? JSON.parse(v) : null; };
  let fast = part('liveFast'), mid = part('liveMid'), slow = part('liveSlow');
  const assemble = (budget) => ({
    at: fast.at,
    activeUsers: fast.activeUsers,
    pages: mid.pages, minutes: mid.minutes, devices: slow.devices,
    partsAt: { mid: mid.at, slow: slow.at },
    budget: budget,
  });
  const remPrev = part('liveRem');
  if (fast && mid && slow) return assemble({ cost: 0, remaining: remPrev && remPrev.v, ttl: null, fresh: {} });   // 전부 캐시 — GA4 호출 없음
  try {
    let cost = 0, remaining = remPrev ? remPrev.v : null;
    const call = (dims, metrics, extra) => {
      const resp = AnalyticsData.Properties.runRealtimeReport(Object.assign({
        dimensions: dims.map((name) => ({ name })),
        metrics: metrics.map((name) => ({ name })),
        limit: 20,
        returnPropertyQuota: true,
      }, extra || {}), 'properties/' + site_().PROPERTY_ID);
      const q = resp.propertyQuota && (resp.propertyQuota.tokensPerProjectPerHour || resp.propertyQuota.tokensPerHour);
      if (q) { cost += q.consumed || 0; remaining = q.remaining; }
      return resp;
    };
    const now = () => new Date().toISOString();
    const fresh = {};
    if (!fast) { const t = rows_(call([], ['activeUsers']))[0] || { activeUsers: 0 }; fast = { at: now(), activeUsers: t.activeUsers || 0 }; fresh.fast = true; }
    if (!mid) {
      mid = {
        at: now(),
        pages: rows_(call(['unifiedScreenName'], ['activeUsers', 'screenPageViews'], { orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }], limit: 8 })),
        minutes: rows_(call(['minutesAgo'], ['activeUsers'], { orderBys: [{ dimension: { dimensionName: 'minutesAgo' } }], limit: 31 })),
      };
      fresh.mid = true;
    }
    if (!slow) { slow = { at: now(), devices: rows_(call(['deviceCategory'], ['activeUsers'])) }; fresh.slow = true; }
    const ttl = liveTtl_(remaining);
    if (fresh.fast) cache.put(ck_('liveFast'), JSON.stringify(fast), ttl);
    if (fresh.mid) cache.put(ck_('liveMid'), JSON.stringify(mid), Math.min(21600, Math.max(CFG.LIVE_MID_SEC, ttl * 6)));
    if (fresh.slow) cache.put(ck_('liveSlow'), JSON.stringify(slow), Math.min(21600, Math.max(CFG.LIVE_SLOW_SEC, ttl * 20)));
    if (remaining != null) cache.put(ck_('liveRem'), JSON.stringify({ v: remaining }), 3600);
    const out = assemble({ cost: cost, remaining: remaining, ttl: ttl, fresh: fresh });   // 이번 요청에 쓴 토큰 / 남은 토큰 / ①의 간격(초) / 새로 받은 단계
    cache.put(ck_('liveLast'), JSON.stringify(out), 21600);
    return out;
  } catch (e) {
    cache.put(ck_('liveCool'), '1', CFG.LIVE_COOLDOWN_SEC);
    return staleLive_(String((e && e.message) || e));
  }
}
function liveTtl_(remaining) {
  if (remaining == null) return CFG.LIVE_CACHE_SEC;
  for (let i = 0; i < CFG.LIVE_BUDGET.length; i++) if (remaining > CFG.LIVE_BUDGET[i][0]) return CFG.LIVE_BUDGET[i][1];
  return CFG.LIVE_BUDGET_MIN_TTL;
}
function staleLive_(why) {
  const last = CacheService.getScriptCache().get(ck_('liveLast'));
  if (!last) return { error: why };
  const o = JSON.parse(last);
  o.stale = true;
  o.staleReason = String(why).slice(0, 160);
  return o;
}

/** 특정 페이지 통계(?mode=page&q=경로/키워드&month=YYYY-MM). q 가 들어 있는 모든 URL(쿼리 포함)을 합쳐 본다.
 *  예) /dbk/dbk_estimate_form.php · goodsNo=11166 · /huawei/ — 결과는 캐시하고, 새 조회는 10분에 PAGE_MAX_PER_10MIN 회까지만 허용한다. */
function pageStats_(q, month) {
  q = String(q || '').replace(/[\u0000-\u001f]/g, '').trim();
  if (q.length < 2 || q.length > 120) return { error: '검색어는 2~120자로 입력해 주세요.' };
  const today = todayKst_(), cur = today.slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(month || '') || month < site_().START_MONTH || month > cur) month = cur;
  const cache = CacheService.getScriptCache();
  const hex = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, q.toLowerCase()).map((b) => ('0' + (b & 255).toString(16)).slice(-2)).join('');
  const ck = ck_('pg:') + month + ':' + hex;
  const hit = cache.get(ck);
  if (hit) return JSON.parse(hit);
  const used = Number(cache.get('pgRate') || 0);
  if (used >= CFG.PAGE_MAX_PER_10MIN) return { error: '조회가 몰려 잠시 쉬는 중입니다. 몇 분 뒤 다시 시도해 주세요.' };
  cache.put('pgRate', String(used + 1), 600);
  const range = { startDate: month + '-01', endDate: month === cur ? today : lastDay_(month) };
  const F = { filter: { fieldName: 'pagePathPlusQueryString', stringFilter: { matchType: 'CONTAINS', value: q, caseSensitive: false } } };
  const L = { andGroup: { expressions: [{ filter: { fieldName: 'landingPagePlusQueryString', stringFilter: { matchType: 'CONTAINS', value: q, caseSensitive: false } } }, convFilter_()] } };
  const LF = { filter: { fieldName: 'landingPagePlusQueryString', stringFilter: { matchType: 'CONTAINS', value: q, caseSensitive: false } } };
  const top = (metric, n) => ({ dimensionFilter: F, orderBys: [{ metric: { metricName: metric }, desc: true }], limit: n });
  try {
    const out = { q: q, month: month, at: new Date().toISOString(), partial: month === cur, errors: [] };
    const part = (name, fn, fb) => { try { return fn(); } catch (e) { const msg = String((e && e.message) || e); if (/Exhausted|quota/i.test(msg)) throw e; out.errors.push(name + ': ' + msg.slice(0, 90)); return fb; } };
    out.total = part('total', () => q_([], ['screenPageViews', 'activeUsers', 'sessions', 'userEngagementDuration'], range, { dimensionFilter: F })[0] || {}, {});
    out.daily = part('daily', () => q_(['date'], ['screenPageViews', 'activeUsers'], range, { dimensionFilter: F, orderBys: [{ dimension: { dimensionName: 'date' } }] }).map((r) => ({ date: ymd_(r.date), screenPageViews: r.screenPageViews, activeUsers: r.activeUsers })), []);
    out.monthly = part('monthly', () => q_(['yearMonth'], ['screenPageViews', 'activeUsers'], { startDate: site_().START_MONTH + '-01', endDate: today }, { dimensionFilter: F, orderBys: [{ dimension: { dimensionName: 'yearMonth' } }] }).map((r) => ({ month: r.yearMonth.slice(0, 4) + '-' + r.yearMonth.slice(4), screenPageViews: r.screenPageViews, activeUsers: r.activeUsers })), []);
    out.sources = part('sources', () => q_(['sessionSourceMedium'], ['sessions', 'screenPageViews'], range, top('sessions', 10)), []);
    out.devices = part('devices', () => q_(['deviceCategory'], ['activeUsers', 'screenPageViews'], range, top('screenPageViews', 5)), []);
    out.urls = part('urls', () => q_(['pagePathPlusQueryString'], ['screenPageViews', 'activeUsers'], range, top('screenPageViews', 15)), []);
    out.events = part('events', () => q_(['eventName'], ['eventCount'], range, top('eventCount', 10)), []);
    // 이 페이지로 처음 들어온 방문(랜딩) 중 전환한 비율
    out.entry = { sessions: 0, conv: {}, byMedium: {} };
    part('entry', () => {
      out.entry.sessions = (q_([], ['sessions'], range, { dimensionFilter: LF })[0] || {}).sessions || 0;
      q_(['pagePath'], ['sessions'], range, { dimensionFilter: L }).forEach((r) => { const id = convIdOf_(r.pagePath); if (id) out.entry.conv[id] = r.sessions; });
      q_(['pagePath', 'sessionSourceMedium'], ['sessions'], range, Object.assign({ dimensionFilter: L }, bySessions_)).forEach((r) => {
        const id = convIdOf_(r.pagePath); if (!id) return;
        const a = (out.entry.byMedium[id] = out.entry.byMedium[id] || []); if (a.length < 8) a.push({ k: r.sessionSourceMedium, s: r.sessions });
      });
    }, null);
    out.defs = site_().CONVERSIONS.map((d) => ({ id: d.id, name: d.name }));
    cache.put(ck, JSON.stringify(out), month === cur ? CFG.PAGE_CACHE_SEC : 3600);
    return out;
  } catch (e) {
    return { error: String((e && e.message) || e).slice(0, 200) };
  }
}

/** 제목 키워드로 견적 카테고리 분류. 워크스테이션 → 서버 → 스토리지 → PC·노트북 → 기타 순으로 판별. */
function classifyTitle_(title) {
  const t = String(title || '');
  if (/workstation|워크스테이션|zbook|z\s*by\s*hp|zgx|z\d+\s*(tower|mini|g\d)|z\d+(g\d)?/i.test(t)) return '워크스테이션';
  if (/서버|server|proliant|poweredge|dl\d+|ml\d+|bl\d+|supermicro|gpu\s*서버|ai\s*서버|xeon|epyc|r\d{3,}[a-z]?g|esc\d+|rs\d+|\d+u\s*rack|rack\s*서버|타워\s*서버|hpe\s|dell\s*(r|m|t)\d/i.test(t)) return '서버';
  if (/스토리지|storage|nas\b|san\b|qnap|synology|netapp|백업|backup|\d+\s*bay|오브젝트\s*스토리지/i.test(t)) return '스토리지';
  if (/노트북|laptop|notebook|데스크탑|desktop|미니\s*pc|mini.{0,3}pc|all.in.one|elitebook|hp\s+envy|서피스|surface\b|pc\s*구매/i.test(t)) return 'PC·노트북';
  return '기타';
}

/** 견적 스프레드시트(견적문의 시트)에서 월별·일별·카테고리별 접수 건수를 집계한다. 30분 캐시. */
function quotesData_() {
  const cache = CacheService.getScriptCache();
  const ck = 'quotesData_v3';
  const hit = cache.get(ck);
  if (hit) { try { return JSON.parse(hit); } catch (e) { /* 캐시 손상 — 재계산 */ } }
  try {
    const ss = SpreadsheetApp.openById(QUOTES_SHEET_ID);
    const sheet = ss.getSheetByName('견적문의');
    if (!sheet) return null;
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return null;
    // A:접수번호 B:제목 C:담당자 D:이메일 E:기관명 F:영업담당 G:접수날짜 H:sno I:유입경로
    const data = sheet.getRange(2, 1, lastRow - 1, 9).getValues();
    const today = todayKst_();
    const monthly = {}, daily = {}, byCategory = {};
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const dateVal = row[6]; // G: 접수날짜
      if (!dateVal) continue;
      let ds;
      if (dateVal instanceof Date) {
        ds = Utilities.formatDate(dateVal, 'Asia/Seoul', 'yyyy-MM-dd');
      } else {
        const s = String(dateVal).trim();
        // '2026-10-22 9:00' 외에 자동저장 행의 '2026. 10. 22 오후 3:12:00'(구분자 뒤 공백)도 허용
        const m = s.match(/(\d{4})\s*[.\-\/]\s*(\d{1,2})\s*[.\-\/]\s*(\d{1,2})/);
        if (!m) continue;
        ds = m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2);
      }
      if (ds > today || ds < '2021-01-01') continue;
      const mk = ds.slice(0, 7);
      const cat = classifyTitle_(String(row[1] || ''));
      monthly[mk] = (monthly[mk] || 0) + 1;
      daily[ds] = (daily[ds] || 0) + 1;
      if (!byCategory[mk]) byCategory[mk] = {};
      byCategory[mk][cat] = (byCategory[mk][cat] || 0) + 1;
    }
    const result = {
      asOf: today,
      source: '구글 스프레드시트(고도몰 es_dbkEstimate DB 실접수 내역) 연동',
      note: '견적 요청 실제 접수 건수 (월별 및 일별 실데이터)',
      monthly: monthly,
      daily: daily,
      byCategory: byCategory,
    };
    cache.put(ck, JSON.stringify(result), 900); // 15분 캐시
    return result;
  } catch (e) {
    Logger.log('quotesData_ 오류: ' + String(e && e.message || e));
    return null;
  }
}

/**
 * 회원가입 달별 최댓값 — 회원 DB 는 1년 넘게 접속 안 한 회원이 휴면 보관소로 옮겨지며 오래된 달일수록 줄어든다.
 * 지금까지 본 값 중 큰 값을 스크립트 속성 SIGNUPS_MAX 에 남겨 그 아래로 내려가지 않게 한다 (예전에는 저장소 data/ref 에 남겼다).
 */
function keepSignupsMax_(monthly) {
  const props = PropertiesService.getScriptProperties();
  let kept = {};
  try { kept = JSON.parse(props.getProperty('SIGNUPS_MAX') || '{}'); } catch (e) { kept = {}; }
  const out = Object.assign({}, monthly);
  let changed = false;
  Object.keys(out).forEach((m) => { if (!(Number(kept[m]) >= out[m])) { kept[m] = out[m]; changed = true; } });
  Object.keys(kept).forEach((m) => { if (Number(kept[m]) > (out[m] || 0)) out[m] = Number(kept[m]); });
  if (changed) props.setProperty('SIGNUPS_MAX', JSON.stringify(kept));
  return out;
}
/** 한 번만 실행: 저장소에 남아 있던 회원가입 바닥값(수집 최댓값·관리자 통계)을 SIGNUPS_MAX 로 옮긴다 */
function seedSignupsMax() {
  const base = 'https://raw.githubusercontent.com/its-mkt/analytics/883c362/data/ref/';
  const kept = {};
  ['godomall-signups.json', 'godomall-signups-admin.json'].forEach((f) => {
    const monthly = JSON.parse(UrlFetchApp.fetch(base + f).getContentText()).monthly || {};
    Object.keys(monthly).forEach((m) => { kept[m] = Math.max(kept[m] || 0, Number(monthly[m]) || 0); });
  });
  const props = PropertiesService.getScriptProperties();
  let cur = {};
  try { cur = JSON.parse(props.getProperty('SIGNUPS_MAX') || '{}'); } catch (e) { cur = {}; }
  Object.keys(cur).forEach((m) => { kept[m] = Math.max(kept[m] || 0, Number(cur[m]) || 0); });
  props.setProperty('SIGNUPS_MAX', JSON.stringify(kept));
  CacheService.getScriptCache().remove('signupsData_v1');
  Logger.log('SIGNUPS_MAX ' + Object.keys(kept).length + '개월 저장');
}

/** 고도몰 회원 DB(es_member) 가입일별 건수 → { monthly, daily }. 15분 캐시. 실패하면 null. monthly 는 달별 최댓값(keepSignupsMax_). */
function signupsData_() {
  const cache = CacheService.getScriptCache();
  const ck = 'signupsData_v1';
  const hit = cache.get(ck);
  if (hit) { try { return JSON.parse(hit); } catch (e) { /* 캐시 손상 — 재계산 */ } }
  try {
    const key = PropertiesService.getScriptProperties().getProperty('ITKET_SYNC_KEY');
    if (!key) throw new Error('스크립트 속성 ITKET_SYNC_KEY 가 없습니다');
    const resp = UrlFetchApp.fetch(SIGNUPS_API_URL, {
      method: 'post',
      payload: { key: key, since: CFG.START_MONTH + '-01' },   // 키는 URL이 아닌 POST 본문으로
      followRedirects: false,
      muteHttpExceptions: true,
    });
    if (resp.getResponseCode() !== 200) throw new Error('가입 API 응답 코드 ' + resp.getResponseCode());
    const data = JSON.parse(resp.getContentText('UTF-8'));
    if (!data.ok || !data.daily) throw new Error('가입 API 오류: ' + (data.error || '형식 불일치'));
    const today = todayKst_();
    const monthly = {}, daily = {};
    Object.keys(data.daily).forEach((d) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || d > today) return;
      const n = Number(data.daily[d]) || 0;
      daily[d] = n;
      monthly[d.slice(0, 7)] = (monthly[d.slice(0, 7)] || 0) + n;
    });
    const result = { asOf: today, source: '고도몰 회원 DB(es_member) 가입일 기준 — 아이티켓 서버 조회 API', monthly: keepSignupsMax_(monthly), daily: daily };
    cache.put(ck, JSON.stringify(result), 900);
    return result;
  } catch (e) {
    Logger.log('signupsData_ 오류: ' + String(e && e.message || e));
    return null;
  }
}

/** 웹앱: ?mode=live | ?mode=cur | ?mode=page&q=..&month=.. | (기본) 전체.
 *  &site=oncore 를 붙이면 같은 모드를 온코어 GA4 로 답한다 (analytics 대시보드의 온코어 화면). 견적·회원가입 실데이터는 아이티켓만 있다.
 *  ?mode=oncore 는 ad-insight 용 가벼운 온코어 월별 값 (기기·주문 완료만) — 예전 응답 형식 그대로. */
function doGet(e) {
  const p = (e && e.parameter) || {};
  const mode = p.mode;
  // 로그인 없이 누구나 받는다 (2026-11-19 로그인 제거 — 집계 숫자뿐이라 막을 실익이 적다)
  let body;
  try {
    if (p.site === 'oncore') body = Object.assign({ site: 'oncore' }, withSite_('oncore', () => oncoreGet_(mode, p)));
    else if (mode === 'live') body = liveNow_();
    else if (mode === 'page') body = pageStats_(p.q, p.month);
    else if (mode === 'oncore') body = Object.assign({ site: 'oncore' }, oncoreSlim_(loadOncore_()));   // ad-insight 대시보드용. site 로 아이티켓 응답과 구분한다
    else if (mode === 'cur') {
      const store = load_(), cur = todayKst_().slice(0, 7), prev = addMonth_(cur, -1);
      const months = {};
      [cur, prev].forEach((m) => { if (store.months[m]) months[m] = store.months[m]; });
      body = { updated: store.updated, months: months, quota: store.quota || null, godoQuotes: quotesData_(), godoSignups: signupsData_() };
    } else {
      const store = load_();
      body = JSON.parse(JSON.stringify(store)); // shallow copy
      body.godoQuotes = quotesData_();
      body.godoSignups = signupsData_();
    }
  } catch (err) { body = { error: String(err && err.message || err) }; }
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON);
}

/** 한 번만 실행: 견적 시트(spreadsheets)·가입 API(외부 호출) 권한 승인 창을 띄우고 둘 다 연결되는지 로그로 확인한다.
 *  웹앱 로그에 'quotesData_ 오류: 권한 없음' / 'signupsData_ 오류' 가 나오면 에디터에서 실행. */
function authorizeSheets() {
  ScriptApp.requireScopes(ScriptApp.AuthMode.FULL, ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/script.external_request']);
  Logger.log('시트 연결 확인: ' + SpreadsheetApp.openById(QUOTES_SHEET_ID).getName());
  CacheService.getScriptCache().remove('signupsData_v1');
  const s = signupsData_();
  Logger.log(s ? '가입 API 연결 확인: 최근 3개월 ' + JSON.stringify(Object.keys(s.monthly).sort().slice(-3).map((m) => m + '=' + s.monthly[m])) : '가입 API 연결 실패 — 위 signupsData_ 오류 참고');
}

/** 한 번만 실행: 자동 실행 트리거(30분 / 3시간)를 만든다. 다시 실행해도 중복되지 않는다. */
function setupTrigger() {
  ScriptApp.getProjectTriggers().filter((t) => ['collectAll', 'collectRecent'].indexOf(t.getHandlerFunction()) >= 0).forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('collectRecent').timeBased().everyMinutes(30).create();
  ScriptApp.newTrigger('collectAll').timeBased().everyHours(3).create();
}

/**
 * 진단용(에디터에서 직접 실행): 특정 페이지의 조회수가 어디서 오는지 출처·국가·기기·날짜별로 로그에 찍는다.
 * 고도몰 통계와 GA4 수치가 크게 다를 때 원인 파악에 쓴다. DIAG 만 바꿔 실행.
 */
function diagnose() {
  const DIAG = { path: '/dbk/dbk_estimate_list.php', month: '2026-09' };
  const range = { startDate: DIAG.month + '-01', endDate: lastDay_(DIAG.month) };
  const filter = { filter: { fieldName: 'pagePath', stringFilter: { matchType: 'EXACT', value: DIAG.path } } };
  const out = ['== ' + DIAG.path + ' (' + DIAG.month + ')'];
  [['sessionSourceMedium', '출처/매체'], ['country', '국가'], ['deviceCategory', '기기'], ['date', '날짜'], ['browser', '브라우저'], ['pagePathPlusQueryString', 'URL(쿼리 포함)']].forEach((d) => {
    const rows = q_([d[0]], ['screenPageViews', 'activeUsers', 'sessions'], range, {
      dimensionFilter: filter, orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }], limit: 6,
    });
    out.push('-- ' + d[1]);
    rows.forEach((r) => out.push('   ' + String(r[d[0]]).slice(0, 70) + ' | PV ' + r.screenPageViews + ' | 방문자 ' + r.activeUsers + ' | 세션 ' + r.sessions));
  });
  Logger.log(out.join('\n'));
}

/**
 * 진단용(에디터에서 직접 실행): GA4 데이터 필터(Internal Traffic)가 "테스트" 상태일 때 직원 접속이 얼마나 걸리는지 로그에 찍는다.
 * 활성화하기 전에 걸리는 양이 합리적인지 확인하는 용도. 읽기 전용이며 웹앱 배포에는 영향이 없다.
 */
function checkInternalFilter() {
  const today = todayKst_();
  const range = { startDate: addMonth_(today.slice(0, 7), -1) + '-01', endDate: today };
  const out = ['== 테스트 데이터 필터 확인 (' + range.startDate + ' ~ ' + range.endDate + ')'];
  ['testDataFilterName', 'testDataFilterId'].forEach((dim) => {
    try {
      const rows = q_([dim], ['eventCount', 'activeUsers', 'sessions', 'screenPageViews'], range, { orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }], limit: 10 });
      out.push('-- ' + dim);
      rows.forEach((r) => out.push('   ' + r[dim] + ' | 이벤트 ' + r.eventCount + ' | 방문자 ' + r.activeUsers + ' | 세션 ' + r.sessions + ' | 조회 ' + r.screenPageViews));
    } catch (e) { out.push('-- ' + dim + ' 조회 실패: ' + String((e && e.message) || e).slice(0, 120)); }
  });
  Logger.log(out.join('\n'));
}

/* ── 온코어 GA4 (analytics 대시보드의 온코어 화면 · ad-insight 의 온코어 기기별 통계·구매 상세) ──
 * 아이티켓 수집(collectRecent · collectAll)과 따로 돈다. 속성·저장 파일·트리거가 모두 달라 실패해도 아이티켓 데이터에 영향이 없다.
 * 월별 값은 아이티켓 월별 파일과 같은 형식이다 — collectMonth_ 를 온코어 속성·전환 정의(withSite_)로 실행한다.
 * 온코어는 견적 완료 화면이 없어(제출 후 알림 → 목록으로 이동) 견적 전환은 세지 않고, 회원가입·주문 완료 화면만 전환으로 센다.
 * 측정 전 달(세션 0)은 조회 1번으로 빈 달만 저장한다 (온코어 GA4 는 2026-10-13 부터 측정).
 * 처음 한 번: 에디터에서 collectOncore 실행(과거 월 채움) → setupOncoreTrigger 실행(3시간마다 당월·전월 갱신).
 * 대시보드는 웹앱 &site=oncore(analytics) · ?mode=oncore(ad-insight) 로 받는다 (doGet). 코드를 고치면 "배포 관리 → 새 버전"으로 다시 배포.
 */
const ONCORE = {
  PROPERTY_ID: '544861334',               // GA4 속성 'on-core' (스트림 '온코어(주)' https://on-core.co.kr)
  START_MONTH: '2025-01',                 // 이 달부터 묻는다. 측정 전 달은 세션 0 으로 저장되고 대시보드는 '측정 전'으로 본다
  FILE_NAME: 'oncore-analytics-data.json',
  SCHEMA: 2,                              // 수집 항목이 바뀌면 올린다 → 과거 월을 다시 채움 (2: 아이티켓과 같은 전체 형식 — 페이지·유입·전환·상품)
  TOP_ROWS: 50,
  CONVERSIONS: [
    { id: 'signup', name: '회원가입 완료', path: '/member/join_ok.php' },
    { id: 'order', name: '주문 완료', path: '/order/order_end.php' },   // 고도몰 공통 주문 완료 화면
  ],
  BUDGET_MS: 3 * 60 * 1000,
};

/** 한 달 치 (아이티켓 collectMonth_ 와 같은 형식). 세션이 없는 달은 빈 달(empty)로 둔다 */
function oncoreMonth_(m, today, reuse) {
  return withSite_('oncore', () => {
    const range = { startDate: m + '-01', endDate: m === today.slice(0, 7) ? today : lastDay_(m) };
    const t = q_([], M, range)[0] || {};
    if (!t.sessions) {
      const zero = {};
      M.forEach((k) => (zero[k] = 0));
      return { v: ONCORE.SCHEMA, month: m, partial: m === today.slice(0, 7), updated: new Date().toISOString(), empty: true, total: zero, daily: [] };
    }
    return collectMonth_(m, today, reuse);
  });
}

/** ad-insight 용 가벼운 형식 (예전 SCHEMA 1 과 같은 항목만): 방문(기기·기기×채널)과 주문 완료 세션(기기·기기×채널·출처/매체) */
function oncoreSlim_(store) {
  const months = {};
  const ks = (rows) => (rows || []).map((r) => ({ k: r.k, s: r.s }));
  Object.keys(store.months || {}).forEach((m) => {
    const x = store.months[m], c = x.conv;
    months[m] = {
      v: x.v, month: x.month, partial: x.partial, updated: x.updated,
      total: { sessions: (x.total && x.total.sessions) || 0, activeUsers: (x.total && x.total.activeUsers) || 0 },
      daily: (x.daily || []).map((r) => ({ date: r.date, sessions: r.sessions })),
      devices: x.devices || [],
      deviceChannels: x.deviceChannels || [],
      conv: c ? {
        defs: [{ id: 'order', name: '주문 완료', path: '/order/order_end.php' }],
        byDevice: { order: ks(c.byDevice && c.byDevice.order) },
        byDeviceChannel: { order: ks(c.byDeviceChannel && c.byDeviceChannel.order) },
        byMedium: { order: ks(c.byMedium && c.byMedium.order) },
      } : undefined,
    };
  });
  return { updated: store.updated, errors: store.errors || [], months: months };
}

/** &site=oncore 요청 (withSite_('oncore') 안에서 불린다): live · page · cur · (기본) 전체 */
function oncoreGet_(mode, p) {
  if (mode === 'live') return liveNow_();
  if (mode === 'page') return pageStats_(p.q, p.month);
  const store = loadOncore_();
  if (mode === 'cur') {
    const cur = todayKst_().slice(0, 7), prev = addMonth_(cur, -1), months = {};
    [cur, prev].forEach((m) => { if (store.months && store.months[m]) months[m] = store.months[m]; });
    return { updated: store.updated, months: months, godoQuotes: null, godoSignups: null };
  }
  return store;
}

// 이름이 아니라 ID 로 연다 (같은 이름의 사본·바로가기를 잡지 않게). 처음 수집할 때 만들고 ID 를 스크립트 속성 ONCORE_FILE_ID 에 둔다
function oncoreFile_(create) {
  const props = PropertiesService.getScriptProperties(), id = props.getProperty('ONCORE_FILE_ID');
  if (id) return DriveApp.getFileById(id);
  if (!create) return null;
  const f = DriveApp.createFile(ONCORE.FILE_NAME, '{"months":{}}', MimeType.PLAIN_TEXT);
  props.setProperty('ONCORE_FILE_ID', f.getId());
  return f;
}
// 파일을 못 읽으면 오류를 낸다 — 빈 값으로 넘어가 다음 저장 때 수집본을 덮어쓰지 않게 (아직 만들기 전이면 빈 값)
function loadOncore_() {
  const f = oncoreFile_(false);
  if (!f) return { months: {} };
  const text = f.getBlob().getDataAsString();
  return text.trim() ? JSON.parse(text) : { months: {} };
}
/** 3시간마다: 당월·전월은 항상 새로, 빠진/구버전 과거 월은 시간 되는 만큼 채운다 (한 달마다 저장 — 시간 초과로 끊겨도 받은 달은 남는다) */
function collectOncore() {
  const started = Date.now(), today = todayKst_(), cur = today.slice(0, 7), prev = addMonth_(cur, -1);
  const store = loadOncore_();
  store.months = store.months || {};
  const all = [];
  for (let m = ONCORE.START_MONTH; m <= cur; m = addMonth_(m, 1)) all.push(m);
  const stale = (m) => !store.months[m] || store.months[m].v !== ONCORE.SCHEMA;
  const queue = [cur, prev].filter((m) => all.indexOf(m) >= 0).concat(all.filter((m) => m !== cur && m !== prev && stale(m)));
  const errors = [];
  const save = () => oncoreFile_(true).setContent(JSON.stringify(store));
  for (const m of queue) {
    if (Date.now() - started > ONCORE.BUDGET_MS) break;   // 남은 달은 다음 실행에서 이어서
    try { store.months[m] = oncoreMonth_(m, today, store.months[m]); store.updated = new Date().toISOString(); save(); }
    catch (e) { errors.push(m + ': ' + e.message); if (/Exhausted|quota/i.test(String(e.message))) break; }
  }
  store.updated = new Date().toISOString();
  store.errors = errors;
  save();
  if (errors.length) throw new Error(errors.join('\n'));   // 실행 기록에 실패로 남김
}
/** 한 번만 실행: collectOncore 3시간 트리거. 다시 실행해도 중복되지 않는다 (아이티켓 트리거는 건드리지 않음) */
function setupOncoreTrigger() {
  ScriptApp.getProjectTriggers().filter((t) => t.getHandlerFunction() === 'collectOncore').forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('collectOncore').timeBased().everyHours(3).create();
}
