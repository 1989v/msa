import { useEffect, useState } from 'react';
import { fetchResumeStatus } from '../api/resumeApi';

/**
 * 이력서 공개 여부 (ADR-0064).
 *
 * 구직 중이 아닐 때는 메인에 진입점을 노출하지 않는다. 조회에 실패하면 닫힌 것으로 본다 —
 * 판단이 안 될 때 열어 두는 쪽으로 기울면 안 되는 값이다.
 */
export function useResumeStatus(): boolean {
  const [publiclyVisible, setPubliclyVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchResumeStatus()
      .then((visible) => {
        if (!cancelled) setPubliclyVisible(visible);
      })
      .catch(() => {
        if (!cancelled) setPubliclyVisible(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return publiclyVisible;
}
