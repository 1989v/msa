import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { createDispenser, type Dispenser } from 'card-dispenser';

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

/**
 * 터치 기기에서 판에 꽂는 카드 상한. 카드 한 장이 3D 요소 다섯 개라 80장이면 레이어 400개 —
 * 모바일 에뮬레이션(DPR 3) 실측 530 레이어·418MB 로 스크롤이 버벅였다. 40장 + 라이트 모드로 줄인다.
 * 데스크탑은 전부 꽂는다.
 */
export const MOBILE_MAX_CARDS = 40;

export function useShownItems<T>(items: T[] | undefined): T[] | undefined {
  const coarse = useCoarsePointer();
  return useMemo(() => (items && coarse && items.length > MOBILE_MAX_CARDS ? items.slice(0, MOBILE_MAX_CARDS) : items), [items, coarse]);
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
      // 터치 기기는 라이트 모드 — 먼 카드의 요소를 셋으로 줄인다
      lite: coarse,
      // 지나가는 카드가 올라왔다 내려가는 물결. 판이 0.66배로 줄어드는 폭에서도 보이게 기본값보다 크고 넓게 잡는다
      // (18px·2.4칸이면 화면에서 12px·네 장이라 티가 안 났다). card-dispenser 0.2.0 부터는 이 값이 기본값이다
      peek: 32,
      peekSpread: 4,
      // 판을 눕혀 본다 — 26도는 위에서 내려다보는 느낌이 강해 카드 얼굴이 눌려 보였다
      tilt: 18,
      // 세로로 끌면 각이 바뀐다. 터치에서는 끈다 — 세로 제스처는 페이지 스크롤의 몫이다
      tiltDrag: !coarse,
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
