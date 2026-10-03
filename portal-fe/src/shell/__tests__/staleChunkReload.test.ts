import { describe, expect, it, vi } from 'vitest';
import { installStaleChunkReload } from '../staleChunkReload';

function host(storage: Storage | null = sessionStorageStub()) {
  const target = new EventTarget();
  const reload = vi.fn();
  const h = {
    addEventListener: target.addEventListener.bind(target),
    get sessionStorage(): Storage {
      if (!storage) throw new DOMException('blocked', 'SecurityError');
      return storage;
    },
    location: { reload },
  };
  const fire = () => {
    const e = new Event('vite:preloadError', { cancelable: true });
    target.dispatchEvent(e);
    return e;
  };
  return { h: h as unknown as Parameters<typeof installStaleChunkReload>[0], reload, fire };
}

function sessionStorageStub(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
  } as Storage;
}

describe('installStaleChunkReload — 청크를 못 받으면 한 번 새로고침', () => {
  it('첫 실패는 새로고침하고 오류를 삼킨다', () => {
    const { h, reload, fire } = host();
    installStaleChunkReload(h, () => 100_000);
    expect(fire().defaultPrevented).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('10초 안의 재실패는 새로고침하지 않는다(무한 반복 방지), 지나면 다시 한다', () => {
    let t = 100_000;
    const { h, reload, fire } = host();
    installStaleChunkReload(h, () => t);
    fire();
    t += 5_000;
    expect(fire().defaultPrevented).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
    t += 6_000;
    fire();
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it('저장소를 못 쓰면 새로고침하지 않는다', () => {
    const { h, reload, fire } = host(null);
    installStaleChunkReload(h, () => 100_000);
    expect(fire().defaultPrevented).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });
});
