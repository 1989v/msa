import { useState } from 'react';
import KhSheet from '../shell/KhSheet';
import DispenserStage, { type DispenserSkin } from './DispenserStage';
import './dispenser.css';

export interface PickSheetProps<T> {
  label: string;
  /** null 이면 아직 불러오는 중 */
  items: T[] | null;
  error?: boolean;
  render: (item: T, index: number) => string;
  describe: (item: T) => { title: string; meta: string };
  caption: [string, string];
  goLabel: string;
  onGo: (item: T) => void;
  onClose: () => void;
  minCards?: number;
  skin?: DispenserSkin;
}

/**
 * 뽑기 시트 — 지금 건 필터의 결과를 판에 꽂고, 열리자마자 한 번 돌려 하나를 세운다.
 * 모바일은 바텀시트, 데스크탑은 가운데 다이얼로그 (KhSheet 의 --dialog 변형).
 * 뽑힌 것은 판 바로 아래에 온다 — 결과가 버튼 옆에 있어야 눌러 본 보람이 있다.
 */
export default function PickSheet<T>({
  label,
  items,
  error = false,
  render,
  describe,
  caption,
  goLabel,
  onGo,
  onClose,
  minCards = 24,
  skin = 'hanji',
}: PickSheetProps<T>) {
  const [picked, setPicked] = useState<T | null>(null);
  const [settled, setSettled] = useState(false);
  const shown = picked ? describe(picked) : null;

  return (
    <KhSheet label={label} onClose={onClose} className="kh-sheet--dialog dsp-sheet">
      {error && <p className="kh-status kh-status-error">목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>}
      {!error && items === null && <div className="kh-skeleton dsp-skeleton" aria-label="불러오는 중" />}
      {!error && items !== null && items.length === 0 && (
        <p className="kh-status">이 조건에는 뽑을 것이 없습니다. 필터를 풀어 보세요.</p>
      )}
      {!error && items !== null && items.length > 0 && (
        <>
          <DispenserStage
            items={items}
            render={render}
            minCards={minCards}
            skin={skin}
            label={label}
            caption={caption}
            pickLabel="다시 뽑기"
            spinOnMount
            onChange={(item) => {
              // 첫 layout 의 정면(스핀 전)은 결과가 아니다 — 멈춘 뒤부터 보여준다
              if (settled) setPicked(item);
            }}
            onPicked={(item) => {
              setSettled(true);
              setPicked(item);
            }}
          />
          <div className={`dsp-result${settled ? '' : ' dsp-result--pending'}`} aria-live="polite">
            <span className="kh-mono dsp-pick-label">{settled ? '뽑힌 것' : '돌리는 중'}</span>
            <b key={shown?.title ?? ''} className="dsp-pick-title">{shown?.title ?? '…'}</b>
            {shown?.meta && <span className="kh-mono dsp-pick-meta">{shown.meta}</span>}
            <div className="dsp-result-acts">
              <button
                type="button"
                className="kh-button"
                disabled={!settled || !picked}
                onClick={() => picked && onGo(picked)}
              >
                {goLabel} <span aria-hidden="true">→</span>
              </button>
              <button type="button" className="kh-button kh-button-ghost" onClick={onClose}>
                닫기
              </button>
            </div>
          </div>
        </>
      )}
    </KhSheet>
  );
}
