// 화면 빌드 → site/ (React + TypeScript + SCSS + Vite)
// 실적 데이터는 화면에 심지 않는다 — 로그인한 승인 계정만 수집기 웹앱에서 받는다 (vite.config.ts loadDashboardPayload)
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

await build({
  root: ROOT,
  configFile: path.join(ROOT, 'vite.config.ts'),
  logLevel: 'warn',
});

console.log('site/ 생성 완료 (실적 데이터 없음 — 로그인 후 웹앱에서 받음)');
