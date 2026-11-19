import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const ROOT = path.dirname(fileURLToPath(import.meta.url));

/**
 * 릴리즈 표기: 배포 날짜(KST) 기준 YY.MM.DD, 당일 여러 번 배포 시 -2, -3 ...
 */
function releaseInfo(): { tag: string; commit: string } {
  const kstDay = (sec: number) =>
    new Date(sec * 1000 + 9 * 3600 * 1000)
      .toISOString()
      .slice(2, 10)
      .replace(/-/g, '.');

  try {
    const git = (cmd: string) =>
      execSync(`git ${cmd}`, {
        cwd: ROOT,
        stdio: ['ignore', 'pipe', 'ignore'],
      })
        .toString()
        .trim();

    const [sha, headSec] = git('log -1 --format=%h%x20%ct').split(' ');
    // 빌드 당일 KST 날짜
    const today = kstDay(Date.now() / 1000);
    const day = kstDay(Number(headSec)) === today ? today : today;
    const n = git('log --first-parent --format=%ct HEAD')
      .split('\n')
      .filter((s) => kstDay(Number(s)) === day).length;

    return { tag: `v${day}${n > 1 ? `-${n}` : ''}`, commit: sha };
  } catch {
    const today = kstDay(Date.now() / 1000);
    return { tag: `v${today}`, commit: '' };
  }
}
const release = releaseInfo();

const readJson = (file: string, fallback: unknown) => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback);

/**
 * 화면에 심는 값 — 제목·주소·내부 트래픽 설정·상품 이름표처럼 공개돼도 되는 값만 둔다.
 * GA4 월별 값·견적·회원가입 같은 실적은 심지 않는다: 로그인한 승인 계정만 수집기 웹앱에서 받는다 (2026-11-18, 경쟁사·봇 차단).
 * 아이티켓 값이 맨 위, 온코어 값은 oncore 아래에 같은 형식으로 둔다.
 */
export function loadDashboardPayload(mode = process.env.NODE_ENV || 'development') {
  const env = loadEnv(mode, ROOT, '');
  const dataDir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(ROOT, 'data');
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'ga4.json'), 'utf8'));
  const liveUrl = process.env.GA4_WEBAPP_URL || env.GA4_WEBAPP_URL || '';
  const oc = cfg.oncore;
  const oncore = oc
    ? {
        site: 'oncore',
        names: readJson(path.join(dataDir, 'oncore', 'names.json'), {}),
        title: oc.title as string,
        siteUrl: oc.siteUrl as string,
        startMonth: (oc.startMonth as string) || '',
        internal: oc.internalFilter || { state: 'pending', since: null },
        liveUrl,
      }
    : undefined;

  return {
    payload: {
      site: 'itket',
      names: readJson(path.join(dataDir, 'names.json'), {}),
      title: cfg.title as string,
      siteUrl: cfg.siteUrl as string,
      internal: cfg.internalFilter || { state: 'pending', since: null },
      liveUrl,
      oncore,
    },
  };
}

/**
 * 화면 주소가 /analytics/itket/conversion 처럼 깊다 (src/utils/route.ts). GitHub Pages 는 그 경로에 파일이 없으면
 * 404.html 을 주므로, 같은 앱(index.html)을 404.html 로도 둬서 주소로 화면을 고른다 (ad-insight 와 같은 방식)
 */
function notFoundPagePlugin(): Plugin {
  let outDir = '';
  return {
    name: 'not-found-page-plugin',
    apply: 'build',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const index = path.join(outDir, 'index.html');
      if (fs.existsSync(index)) fs.copyFileSync(index, path.join(outDir, '404.html'));
    },
  };
}

function itketDataPlugin(): Plugin {
  return {
    name: 'itket-data-plugin',
    transformIndexHtml(html) {
      const { payload } = loadDashboardPayload();
      const json = JSON.stringify(payload).replace(/</g, '\\u003c');
      return html
        .replace(/__TITLE__/g, payload.title)
        .replace('"__DATA__"', () => json);
    },
  };
}

export default defineConfig(({ command }) => ({
  // 배포 주소가 공용 도메인 아래 경로(https://its.itket.com/analytics/)이고 화면 주소가 깊어지므로(/analytics/itket/conversion)
  // 파일을 그 경로 기준으로 찾는다. 개발 서버는 예전처럼 localhost:1000/ 에서 연다 (화면 주소는 /itket/conversion)
  base: command === 'build' ? '/analytics/' : '/',
  define: {
    __APP_RELEASE__: JSON.stringify(command === 'serve' ? `${release.tag}-dev` : release.tag),
    __APP_COMMIT__: JSON.stringify(release.commit),
  },
  server: {
    port: 1000,
    strictPort: true,
  },
  preview: {
    port: 1000,
    strictPort: true,
  },
  plugins: [react(), itketDataPlugin(), notFoundPagePlugin()],
  build: {
    outDir: process.env.SITE_DIR ? path.resolve(process.env.SITE_DIR) : path.join(ROOT, 'site'),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
}));
