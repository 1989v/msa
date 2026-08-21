import { useEffect, useRef, useState, type ReactNode, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';

/**
 * 바텀시트 — 모바일에서 다이얼로그를 대신한다 (kh-motion-app-shell spec §4).
 *
 * 먹빛 veil 위로 판이 올라오고, 손잡이를 아래로 끌면 닫힌다.
 * 스타일은 kh-shell.css (.kh-sheet-*).
 */
export default function KhSheet({
  label,
  onClose,
  children,
  className,
}: {
  label?: string;
  onClose: () => void;
  children: ReactNode;
  /** 변형 클래스 — `kh-sheet--dialog` 는 데스크탑(≥768px)에서 가운데 다이얼로그가 된다 */
  className?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [dragY, setDragY] = useState(0);
  const dragStart = useRef<number | null>(null);

  useEffect(() => {
    panelRef.current?.focus();
    // 뒤 페이지 스크롤을 잠근다 — 시트가 떠 있는 동안 지면은 멈춘 종이다
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const onHandleDown = (e: PointerEvent<HTMLDivElement>) => {
    dragStart.current = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onHandleMove = (e: PointerEvent<HTMLDivElement>) => {
    if (dragStart.current === null) return;
    setDragY(Math.max(0, e.clientY - dragStart.current));
  };
  const onHandleUp = () => {
    if (dragStart.current === null) return;
    const shouldClose = dragY > 96;
    dragStart.current = null;
    setDragY(0);
    if (shouldClose) onClose();
  };

  return createPortal(
    <div className="kh-sheet-veil" onClick={onClose}>
      <div
        ref={panelRef}
        className={className ? `kh-sheet ${className}` : 'kh-sheet'}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={dragY > 0 ? { transform: `translateY(${dragY}px)`, animation: 'none' } : undefined}
      >
        <div
          className="kh-sheet-handle"
          onPointerDown={onHandleDown}
          onPointerMove={onHandleMove}
          onPointerUp={onHandleUp}
          onPointerCancel={onHandleUp}
        >
          <span className="kh-sheet-grip" aria-hidden="true" />
        </div>
        {label && <div className="kh-mono kh-sheet-label">{label}</div>}
        {children}
      </div>
    </div>,
    document.body,
  );
}
