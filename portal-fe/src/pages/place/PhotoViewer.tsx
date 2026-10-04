import { useEffect, useRef } from 'react';
import type { PlaceLang } from '../../api/placeApi';
import type { GalleryImage } from './placeView';

const UI = {
  ko: { label: '사진 크게 보기', prev: '이전 사진', next: '다음 사진', close: '닫기', photo: '사진' },
  en: { label: 'Photo viewer', prev: 'Previous photo', next: 'Next photo', close: 'Close', photo: 'photo' },
} as const;

/**
 * 관광지 사진 크게 보기 — 상세의 큰 사진을 누르면 연다.
 * 좌우 버튼과 방향키(←/→)로 넘기고(끝에서 처음으로 돈다), Esc·닫기·바깥 클릭으로 닫는다.
 * 넘긴 장은 상세의 큰 사진에도 그대로 남는다 — 번호를 상세와 같이 쓴다.
 */
export default function PhotoViewer({
  images,
  index,
  onIndex,
  onClose,
  title,
  lang,
}: {
  images: GalleryImage[];
  index: number;
  onIndex: (index: number) => void;
  onClose: () => void;
  title: string;
  lang: PlaceLang;
}) {
  const L = UI[lang];
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const many = images.length > 1;
  const go = (step: number) => onIndex((index + step + images.length) % images.length);

  useEffect(() => {
    // 연 버튼으로 초점을 돌려줘야 키보드 사용자가 제자리로 돌아온다
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
      opener?.focus();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (many && e.key === 'ArrowLeft') onIndex((index - 1 + images.length) % images.length);
      else if (many && e.key === 'ArrowRight') onIndex((index + 1) % images.length);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, images.length, many, onClose, onIndex]);

  const image = images[index] ?? images[0];
  if (!image) return null;
  return (
    <div
      className="place-photo-viewer"
      role="dialog"
      aria-modal="true"
      aria-label={L.label}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <button ref={closeRef} type="button" className="place-photo-viewer-close" aria-label={L.close} onClick={onClose}>
        ×
      </button>
      <img className="place-photo-viewer-img" src={image.url} alt={image.name || `${title} ${L.photo}`} />
      {many && (
        <>
          <button type="button" className="place-photo-viewer-nav" data-dir="prev" aria-label={L.prev} onClick={() => go(-1)}>
            ‹
          </button>
          <button type="button" className="place-photo-viewer-nav" data-dir="next" aria-label={L.next} onClick={() => go(1)}>
            ›
          </button>
          <span className="place-photo-viewer-count">
            {index + 1} / {images.length}
          </span>
        </>
      )}
    </div>
  );
}
