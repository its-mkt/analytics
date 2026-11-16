import type { FC } from 'react';

export interface SourceLinkItem {
  label: string;
  href?: string;
}

interface SourceNoticeProps {
  sources: SourceLinkItem[];
  className?: string;
}

export const SourceNotice: FC<SourceNoticeProps> = ({ sources, className = '' }) => (
  <footer className={`sec-src ${className}`.trim()}>
    {sources.map((src, idx) =>
      src.href ? (
        <a
          key={`${src.label}-${idx}`}
          href={src.href}
          target="_blank"
          rel="noopener noreferrer"
        >
          {src.label}
        </a>
      ) : (
        <span key={`${src.label}-${idx}`}>{src.label}</span>
      ),
    )}
  </footer>
);

// 하위 호환 alias
export const SecSrc = SourceNotice;

/** 출처 줄의 쇼핑몰 링크 — 보고 있는 사이트(설정의 siteUrl)를 따른다 */
export const storeSource = (siteUrl: string): SourceLinkItem => ({
  label: /on-core/.test(siteUrl) ? '온코어 공식 스토어' : '아이티켓 공식 스토어',
  href: siteUrl,
});
