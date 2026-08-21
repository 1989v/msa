import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import HouseAdInterstitial from './HouseAdInterstitial';
import { unlockSnippets } from '../../api/portfolioApi';
import { storeUnlockToken } from './snippetUnlock';
import './GatedCodeSnippet.css';

/**
 * 화면 계약 — 공개면(잠김/열림)과 이력서(항상 열림)가 같은 형태로 넘긴다.
 * 이력서 쪽은 `locked: false` 로 매핑해 쓰면 된다 (잠금은 공개면만의 개념, ADR-0064).
 */
export interface GatedSnippetView {
  id: number | null;
  title: string | null;
  language: string;
  filePath: string | null;
  lineStart: number | null;
  lineEnd: number | null;
  gitUrl: string | null;
  previewCode: string;
  totalLines: number;
  locked: boolean;
  code: string | null;
}

/**
 * 코드 스니펫 판 — "화면 속의 화면"이라 라이트 모드에서도 어두운 판(`.kh-slab`) 위에 놓는다.
 *
 * 잠긴 상태: 미리보기 아래를 먹으로 가라앉히고(그라데이션), 여는 길 둘을 놓는다 —
 * 로그인(`/shop/login?next=` AuthButton 패턴) 또는 하우스 광고 시청(보상 토큰).
 * 광고를 다 보면 토큰을 발급받아 세션에 담고 호출부에 알린다 — 재조회는 호출부의 일이다.
 */
export default function GatedCodeSnippet({
  snippet,
  onUnlocked,
}: {
  snippet: GatedSnippetView;
  /** 광고 보상 토큰 수령 시 — 호출부가 이 토큰으로 재조회한다. 잠긴 스니펫에만 필요. */
  onUnlocked?: (token: string) => void;
}) {
  const { pathname, search } = useLocation();
  const [adOpen, setAdOpen] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [unlockFailed, setUnlockFailed] = useState(false);

  const shownCode = snippet.locked ? snippet.previewCode : (snippet.code ?? snippet.previewCode);
  // 전문이 미리보기 줄 수보다 짧으면 잠겨 있어도 이미 전부 보인다 — 잠금 띠를 그리지 않는다
  const previewLineCount = snippet.previewCode.split('\n').length;
  const gated = snippet.locked && snippet.totalLines > previewLineCount;

  const lineRange =
    snippet.lineStart != null
      ? snippet.lineEnd != null
        ? `L${snippet.lineStart}–L${snippet.lineEnd}`
        : `L${snippet.lineStart}`
      : null;

  const finishAd = async () => {
    setAdOpen(false);
    setUnlocking(true);
    setUnlockFailed(false);
    try {
      const { token } = await unlockSnippets();
      storeUnlockToken(token);
      onUnlocked?.(token);
    } catch {
      setUnlockFailed(true);
    } finally {
      setUnlocking(false);
    }
  };

  return (
    <article className="premium-snippet kh-slab">
      <div className="premium-snippet-head">
        <span className="premium-snippet-lang">{snippet.language}</span>
        {snippet.title && <h4 className="premium-snippet-title">{snippet.title}</h4>}
        {snippet.gitUrl && (
          <a
            className="premium-snippet-git"
            href={snippet.gitUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            View on Git ↗
          </a>
        )}
      </div>

      {(snippet.filePath || lineRange) && (
        <div className="premium-snippet-meta">
          {snippet.filePath && <span className="premium-snippet-path">{snippet.filePath}</span>}
          {lineRange && <span className="premium-snippet-lines">{lineRange}</span>}
        </div>
      )}

      <div className={`premium-snippet-window${gated ? ' is-gated' : ''}`}>
        <pre className="premium-snippet-code">
          <code>{shownCode}</code>
        </pre>
      </div>

      {gated && (
        <div className="premium-snippet-lockbar">
          <span className="premium-snippet-locknote">
            전체 {snippet.totalLines}줄 중 {previewLineCount}줄 미리보기
          </span>
          <div className="premium-snippet-actions">
            <a
              className="premium-lock-btn premium-lock-btn-primary"
              href={`/shop/login?next=${encodeURIComponent(pathname + search)}`}
            >
              로그인하고 전체 보기
            </a>
            <button
              type="button"
              className="premium-lock-btn premium-lock-btn-ghost"
              onClick={() => setAdOpen(true)}
              disabled={unlocking}
            >
              {unlocking ? '여는 중…' : '광고 보고 전체 보기'}
            </button>
          </div>
          {unlockFailed && (
            <p className="premium-snippet-error" role="alert">
              잠금 해제에 실패했습니다. 잠시 후 다시 시도해 주세요.
            </p>
          )}
        </div>
      )}

      {adOpen && <HouseAdInterstitial onDone={finishAd} onClose={() => setAdOpen(false)} />}
    </article>
  );
}
