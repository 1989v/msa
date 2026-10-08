import { useState } from 'react';
import './SharePanel.css';

const LABELS = {
  ko: { group: '공유', copy: '링크 복사', copied: '복사됨', share: '공유', newWindow: '새 창' },
  en: { group: 'Share', copy: 'Copy link', copied: 'Copied', share: 'Share', newWindow: 'new window' },
} as const;

interface Props {
  /** 서버가 준 단축 주소. 노출 설정이 꺼져 있으면 null 이고, 그때는 `url` 을 쓴다 */
  shortUrl?: string | null;
  /** 단축 주소가 없을 때 쓸 주소. 비우면 현재 페이지 주소 */
  url?: string;
  title: string;
  lang?: 'ko' | 'en';
  /** 놓이는 화면의 배치 규칙을 붙일 클래스 */
  className?: string;
}

/**
 * 공유 — 블로그 글·게임·관광지 상세가 같이 쓴다.
 *
 * 복사·Web Share·외부 공유 링크가 모두 **한 주소**를 쓴다. 단축 주소가 있으면 그것,
 * 없으면 호출자가 넘긴 canonical 주소다. 현재 주소를 그대로 복사하면 쿼리스트링·앵커가 섞여
 * 같은 글이 여러 주소로 돌아다니고, 그러면 색인도 공유 카드도 갈라진다.
 */
export default function SharePanel({ shortUrl, url, title, lang = 'ko', className }: Props) {
  const [copied, setCopied] = useState(false);
  const L = LABELS[lang];
  const target = shortUrl || url || window.location.href;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(target);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // 클립보드 권한이 없는 브라우저 — 주소창에서 복사하도록 둔다
      window.prompt(L.copy, target);
    }
  };

  const share = async () => {
    // Web Share 는 모바일에서 카카오톡·메시지로 바로 넘어가는 유일한 경로다
    if (navigator.share) {
      try {
        await navigator.share({ title, url: target });
        return;
      } catch {
        // 사용자가 취소한 경우 — 복사로 떨어지지 않는다
        return;
      }
    }
    void copy();
  };

  const encoded = encodeURIComponent(target);
  const encodedTitle = encodeURIComponent(title);

  return (
    <div className={`share-panel${className ? ` ${className}` : ''}`} role="group" aria-label={L.group}>
      <button type="button" className="share-panel__btn" onClick={copy}>
        <span aria-live="polite">{copied ? L.copied : L.copy}</span>
      </button>
      <button type="button" className="share-panel__btn" onClick={share}>
        {L.share}
      </button>
      <a
        className="share-panel__btn"
        href={`https://twitter.com/intent/tweet?url=${encoded}&text=${encodedTitle}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`X (${L.newWindow})`}
      >
        X
      </a>
      <a
        className="share-panel__btn"
        href={`https://www.linkedin.com/sharing/share-offsite/?url=${encoded}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`LinkedIn (${L.newWindow})`}
      >
        LinkedIn
      </a>
    </div>
  );
}
