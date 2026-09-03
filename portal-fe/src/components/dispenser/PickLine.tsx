import './dispenser.css';

/**
 * "지금 뽑힌 것" 한 줄 — 제목은 바뀔 때 찍힘(.kh-stamp 와 같은 240ms)으로 들어온다.
 * 스핀 중에는 라이브러리가 onChange 를 미루므로 여기 제목이 빠르게 바뀌지 않는다.
 */
export default function PickLine({
  label,
  title,
  meta,
  href,
  external = false,
}: {
  label: string;
  title: string | null;
  meta: string | null;
  href: string | null;
  external?: boolean;
}) {
  const body = (
    <>
      {/* key 가 바뀌면 다시 마운트되어 애니메이션이 재생된다 */}
      <b key={title ?? ''} className="dsp-pick-title">{title ?? '—'}</b>
      {meta && <span className="kh-mono dsp-pick-meta">{meta}</span>}
    </>
  );
  return (
    <div className="dsp-pick">
      <span className="kh-mono dsp-pick-label">{label}</span>
      {href ? (
        <a
          className="dsp-pick-v"
          href={href}
          {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        >
          {body}
        </a>
      ) : (
        <span className="dsp-pick-v">{body}</span>
      )}
    </div>
  );
}
