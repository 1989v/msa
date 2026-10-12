import { describe, expect, it, vi } from 'vitest';
import { parseInvitation, queryInvitation, rootInvitation, shareInvitation } from '../invitation';
describe('short invitation boundary', () => {
  it.each([' abc234 ', 'abc-234', 'https://game.1989v.com/?r=abc234', 'https://game.1989v.com/party/ABC234', 'https://game.1989v.com/en/party/ABC234'])('normalizes %s', (value) => {
    expect(parseInvitation(value)).toEqual({ kind: 'join', code: 'ABC234' });
  });
  it.each(['', 'ABC123', 'ABC23O', '?r=ABC234', 'https://game.1989v.com/?r=ABC234&r=ABC234', 'https://game.1989v.com/', 'https://game.1989v.com/?r='])('rejects malformed %s', (value) => {
    expect(parseInvitation(value)).toEqual({ kind: 'invalid' });
  });
  it('distinguishes missing from empty and duplicate query', () => {
    expect(queryInvitation('?x=1')).toEqual({ kind: 'none' });
    expect(queryInvitation('?r=')).toEqual({ kind: 'invalid' });
    expect(queryInvitation('?r=ABC234&r=DEF567')).toEqual({ kind: 'invalid' });
  });
  it('root invitations apply only to game host and loopback dev root', () => {
    for (const host of ['game.1989v.com', 'localhost', '127.0.0.1']) {
      expect(rootInvitation(host, '/', '?r=ABC234')).toEqual({ kind: 'join', code: 'ABC234' });
      expect(rootInvitation(host, '/draw', '?r=ABC234')).toEqual({ kind: 'none' });
    }
    for (const host of ['1989v.com', 'place.1989v.com', 'blog.1989v.com', 'resume.1989v.com']) {
      expect(rootInvitation(host, '/', '?r=ABC234')).toEqual({ kind: 'none' });
    }
  });
  it('share cancellation is silent, other failures are not success', async () => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: vi.fn().mockRejectedValue(new DOMException('cancel', 'AbortError')) });
    expect(await shareInvitation('https://game.1989v.com/?r=ABC234')).toBe('cancelled');
    vi.mocked(navigator.share).mockRejectedValueOnce(new Error('denied'));
    expect(await shareInvitation('x')).toBe('failed');
    vi.mocked(navigator.share).mockResolvedValueOnce();
    expect(await shareInvitation('x')).toBe('shared');
  });
});
