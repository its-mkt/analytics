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
const readMonths = (ga4Dir: string) => {
  const files = fs.existsSync(ga4Dir) ? fs.readdirSync(ga4Dir).filter((f) => /^\d{4}-\d{2}\.json$/.test(f)).sort() : [];
  const months: Record<string, unknown> = {};
  for (const f of files) months[f.slice(0, 7)] = JSON.parse(fs.readFileSync(path.join(ga4Dir, f), 'utf8'));
  return months;
};

/**
 * 화면에 심는 데이터. 아이티켓 값이 맨 위(예전 형식 그대로), 온코어 값은 oncore 아래에 같은 형식으로 둔다.
 * 온코어: data/oncore/ga4/*.json · data/oncore/names.json, 제목·주소는 config/ga4.json 의 oncore. 견적·회원가입 실데이터는 아이티켓만 있다.
 */
export function loadDashboardPayload(mode = process.env.NODE_ENV || 'development') {
  const env = loadEnv(mode, ROOT, '');
  const dataDir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(ROOT, 'data');
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'ga4.json'), 'utf8'));
  const liveUrl = process.env.GA4_WEBAPP_URL || env.GA4_WEBAPP_URL || '';
  const months = readMonths(path.join(dataDir, 'ga4'));
  const oc = cfg.oncore;
  const ocDir = path.join(dataDir, 'oncore');
  const oncore = oc
    ? {
        site: 'oncore',
        names: readJson(path.join(ocDir, 'names.json'), {}),
        godoSignups: null,
        godoQuotes: null,
        title: oc.title as string,
        siteUrl: oc.siteUrl as string,
        internal: oc.internalFilter || { state: 'pending', since: null },
        meta: readJson(path.join(ocDir, 'ga4', '_meta.json'), { updated: null }),
        months: readMonths(path.join(ocDir, 'ga4')),
        liveUrl,
      }
    : undefined;

  return {
    fileCount: Object.keys(months).length,
    payload: {
      site: 'itket',
      names: readJson(path.join(dataDir, 'names.json'), {}),
      godoSignups: readJson(path.join(dataDir, 'ref', 'godomall-signups.json'), null),
      godoSignupsAdmin: readJson(path.join(dataDir, 'ref', 'godomall-signups-admin.json'), null),
      godoQuotes: readJson(path.join(dataDir, 'ref', 'godomall-quotes.json'), null),
      title: cfg.title as string,
      siteUrl: cfg.siteUrl as string,
      internal: cfg.internalFilter || { state: 'pending', since: null },
      meta: readJson(path.join(dataDir, 'ga4', '_meta.json'), { updated: null }),
      months,
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
