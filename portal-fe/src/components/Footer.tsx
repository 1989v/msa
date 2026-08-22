import { useState, type ReactNode } from 'react';
import ServiceExplorer from './chrome/ServiceExplorer';
import './Footer.css';

/**
 * 전 콘텐츠 화면 공통 푸터.
 *
 * - © 한 줄만 — 기술 스택 나열("Built with …")은 뺐다: 백엔드가 코틀린인 사이트에서
 *   FE 스택 세 개를 적는 건 사실도 아니고 알림도 아니다.
 * - 상시 링크 열(홈/기술/포트폴리오/샵)도 두지 않는다 — 약한 진입점을 늘어놓는 대신
 *   '서비스 탐색' 버튼 하나가 오버레이로 전체 서비스를 연다.
 * - 호스트 특화 내용(출처 고지·제휴 조건·스튜디오 링크)은 children 슬롯으로 받는다.
 *   deal 의 제휴 고지처럼 법적 의무가 있는 문구가 이 자리에 산다.
 *
 * 라우터 밖(테스트 단독 렌더 포함)에서도 동작해야 하므로 Link 를 쓰지 않는다 —
 * 슬롯 내용은 각 화면이 자기 컨텍스트에 맞게 넣는다.
 */
export default function Footer({ children }: { children?: ReactNode }) {
  const [explorerOpen, setExplorerOpen] = useState(false);

  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-row">
          <span className="site-footer-mark kh-mono">1989V</span>
          <button
            type="button"
            className="site-footer-explore"
            aria-haspopup="dialog"
            onClick={() => setExplorerOpen(true)}
          >
            서비스 탐색
          </button>
        </div>
        {children && <div className="site-footer-slot">{children}</div>}
        <p className="site-footer-copy">
          © 2026 Gideok Kwon. All rights reserved.
          {/* 광고·분석을 싣는 모든 화면에서 방침에 닿아야 한다 (ADR-0076). 상대 경로라
              서브도메인에서는 그 호스트가 같은 라우트를 그린다 — canonical 은 apex 다. */}
          <a className="site-footer-policy" href="/privacy">
            개인정보처리방침
          </a>
        </p>
      </div>

      {explorerOpen && <ServiceExplorer onClose={() => setExplorerOpen(false)} />}
    </footer>
  );
}
