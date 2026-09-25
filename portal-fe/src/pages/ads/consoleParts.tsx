import { useEffect, useState } from 'react';
import { VIRTUAL_CREDIT_NOTE, fetchPreviewBlob } from '../../api/adsConsoleApi';
import type { Tone } from './consoleView';

/**
 * 콘솔 화면들이 함께 쓰는 조각 — 상태 표시·금액 고지·인증 미리보기.
 * 광고주가 적은 문자열은 어디서든 텍스트 노드로만 그린다(HTML 로 해석하지 않는다).
 */

/** 상태는 색만으로 말하지 않는다 — 점·테두리 모양과 글자가 함께 간다. */
export function StatePill({ tone, label }: { tone: Tone; label: string }) {
  return (
    <span className={`adc-state adc-state--${tone}`}>
      <i aria-hidden="true" />
      {label}
    </span>
  );
}

/** 금액 옆 고지. 콘솔의 모든 금액 곁에 붙는다. */
export function CreditNote() {
  return <span className="adc-credit-note">{VIRTUAL_CREDIT_NOTE}</span>;
}

/**
 * 인증 경로의 미리보기 이미지. 받아서 blob 주소로 그린다 — 실패를 화면이 알 수 있게.
 */
export function PreviewImage({ url, alt }: { url: string; alt: string }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    if (typeof URL.createObjectURL !== 'function') return undefined;
    let objectUrl: string | null = null;
    let cancelled = false;
    fetchPreviewBlob(url)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);

  return src ? <img className="adc-preview" src={src} alt={alt} /> : <span className="adc-preview adc-preview--empty" aria-hidden="true" />;
}
