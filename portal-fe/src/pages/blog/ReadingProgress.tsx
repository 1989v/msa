import { useEffect, useState } from 'react';

/**
 * 글 읽은 정도를 화면 맨 위 가는 띠로 보인다.
 *
 * 스크롤 이벤트마다 계산하지 않고 `requestAnimationFrame` 한 프레임에 한 번만
 * 계산한다 — 스크롤은 초당 수십 번 오는데 레이아웃 값(`scrollHeight`)을 그때마다
 * 읽으면 강제 리플로가 그만큼 생긴다.
 *
 * 문서가 화면보다 짧으면(스크롤할 것이 없으면) 띠를 아예 그리지 않는다. 항상 0%
 * 이거나 항상 100% 인 게이지는 정보가 아니다.
 */
export default function ReadingProgress() {
  const [ratio, setRatio] = useState(0);
  const [scrollable, setScrollable] = useState(false);

  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const doc = document.documentElement;
      const span = doc.scrollHeight - window.innerHeight;
      if (span <= 0) {
        setScrollable(false);
        return;
      }
      setScrollable(true);
      setRatio(Math.min(1, Math.max(0, window.scrollY / span)));
    };
    const schedule = () => {
      if (frame === 0) frame = window.requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    // 본문은 마크다운을 그린 뒤에야 길이가 정해진다 — 첫 계산이 그보다 빠르면
    // 스크롤할 것이 없다고 잘못 판단한다. 문서 크기 변화를 직접 본다.
    const observer = new ResizeObserver(schedule);
    observer.observe(document.body);

    return () => {
      if (frame !== 0) window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      observer.disconnect();
    };
  }, []);

  if (!scrollable) return null;

  const percent = Math.round(ratio * 100);
  return (
    <div
      className="blog-progress"
      role="progressbar"
      aria-label="글 읽은 정도"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
    >
      <div className="blog-progress__fill" style={{ transform: `scaleX(${ratio})` }} />
    </div>
  );
}
