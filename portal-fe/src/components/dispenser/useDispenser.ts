import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { createDispenser, type Dispenser } from '../../lib/card-dispenser';

/**
 * card-dispenser 를 React 안에서 쓰는 다리. 라이브러리는 React 를 모르므로
 * 여기서 만들고(mount) 치운다(unmount). render/onChange 는 ref 로 넘겨 항목이 같으면
 * 다시 만들지 않는다 — 판을 다시 세우면 돌던 각도가 0 으로 돌아간다.
 */
export interface UseDispenserOptions<T> {
  items: T[];
  render: (item: T, index: number) => string;
  onChange?: (item: T, index: number) => void;
  /** 일어난 정면 카드를 탭·클릭·Enter 했을 때 — 링크로 보내는 자리 */
  onActivate?: (item: T, index: number) => void;
  minCards?: number;
  label: string;
}

/** 터치 기기 — 스크롤이 판을 돌리지 않고 뽑기가 주 조작이다 (README 입력 정책) */
export function useCoarsePointer(): boolean {
  return useMemo(
    () => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches === true,
    [],
  );
}

export function useDispenser<T>({ items, render, onChange, onActivate, minCards, label }: UseDispenserOptions<T>): {
  hostRef: RefObject<HTMLDivElement | null>;
  apiRef: RefObject<Dispenser<T> | null>;
} {
  const hostRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<Dispenser<T> | null>(null);
  const renderRef = useRef(render);
  const onChangeRef = useRef(onChange);
  const onActivateRef = useRef(onActivate);
  const coarse = useCoarsePointer();
  // 최신 콜백을 ref 에 보관 — 항목이 같으면 판을 다시 세우지 않으면서도 새 콜백을 쓴다
  useEffect(() => {
    renderRef.current = render;
    onChangeRef.current = onChange;
    onActivateRef.current = onActivate;
  });

  useEffect(() => {
    const host = hostRef.current;
    if (!host || items.length === 0) return;
    const api = createDispenser(host, {
      items,
      minCards,
      label,
      // 축소된 판(모바일)에서도 뽑힌 카드가 읽히게 더 키운다
      pullScale: coarse ? 0.32 : 0.1,
      render: (item, i) => renderRef.current(item, i),
      onChange: (item, i) => onChangeRef.current?.(item, i),
      onActivate: (item, i) => onActivateRef.current?.(item, i),
    });
    apiRef.current = api;
    return () => {
      api.destroy();
      apiRef.current = null;
    };
  }, [items, minCards, label, coarse]);

  return { hostRef, apiRef };
}
