import { useState } from 'react';

/**
 * 공유 (ADR-0072).
 *
 * **canonical 절대 URL 하나만 쓴다.** 현재 주소를 그대로 복사하면 쿼리스트링·앵커가 섞여
 * 같은 글이 여러 주소로 돌아다니고, 그러면 색인도 공유 카드도 갈라진다.
 */
export default function SharePanel({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // 클립보드 권한이 없는 브라우저 — 주소창에서 복사하도록 둔다
      window.prompt('링크 복사', url);
    }
  };

  const share = async () => {
    // Web Share 는 모바일에서 카카오톡·메시지로 바로 넘어가는 유일한 경로다
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // 사용자가 취소한 경우 — 복사로 떨어지지 않는다
        return;
      }
    }
    void copy();
  };

  const encoded = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  return (
    <div className="blog-share">
      <button type="button" className="blog-share__btn" onClick={copy}>
        {copied ? '복사됨' : '링크 복사'}
      </button>
      <button type="button" className="blog-share__btn" onClick={share}>
        공유
      </button>
      <a
        className="blog-share__btn"
        href={`https://twitter.com/intent/tweet?url=${encoded}&text=${encodedTitle}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        X
      </a>
      <a
        className="blog-share__btn"
        href={`https://www.linkedin.com/sharing/share-offsite/?url=${encoded}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        LinkedIn
      </a>
    </div>
  );
}
