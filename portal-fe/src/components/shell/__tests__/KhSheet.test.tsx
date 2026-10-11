import { useCallback, useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import KhSheet from '../KhSheet';

/*
 * 공용 시트의 키보드 동작. 판정 근거는 document.activeElement — 시트가 실제로 옮긴 포커스다.
 */
function Harness() {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        열기
      </button>
      {open && (
        <KhSheet label="시트" onClose={close}>
          <button type="button">첫째</button>
          <a href="/x">둘째</a>
          <button type="button" onClick={close}>
            닫기
          </button>
        </KhSheet>
      )}
    </>
  );
}

const open = () => {
  const opener = screen.getByRole('button', { name: '열기' });
  opener.focus();
  fireEvent.click(opener);
  return opener;
};

describe('KhSheet 포커스', () => {
  it('열면 판으로, Escape 로 닫으면 연 버튼으로 포커스가 돌아온다', () => {
    render(<Harness />);
    const opener = open();
    expect(document.activeElement).toBe(screen.getByRole('dialog', { name: '시트' }));

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('안의 버튼으로 닫아도 연 버튼으로 돌아온다', () => {
    render(<Harness />);
    const opener = open();
    fireEvent.click(screen.getByRole('button', { name: '닫기' }));
    expect(document.activeElement).toBe(opener);
  });

  it('마지막 요소에서 Tab → 첫 요소', () => {
    render(<Harness />);
    open();
    screen.getByRole('button', { name: '닫기' }).focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '첫째' }));
  });

  it('첫 요소에서 Shift+Tab → 마지막 요소, 판에 포커스가 있을 때도 마지막으로', () => {
    render(<Harness />);
    open();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '닫기' }));

    screen.getByRole('button', { name: '첫째' }).focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '닫기' }));
  });

  it('가운데 요소의 Tab 은 막지 않는다 — 브라우저 기본 이동에 맡긴다', () => {
    render(<Harness />);
    open();
    screen.getByRole('link', { name: '둘째' }).focus();
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    document.dispatchEvent(tab);
    expect(tab.defaultPrevented).toBe(false);
  });
});
