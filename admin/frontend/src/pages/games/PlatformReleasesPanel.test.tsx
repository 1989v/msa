import { describe, it, expect } from 'vitest';
import { normalizeRobloxPlaceId } from './usePlatformReleaseDraft';
describe('Roblox input', () => {
  it('preserves large IDs and accepts real game slug paths', () => {
    expect(normalizeRobloxPlaceId('12345678901234567890')).toBe('12345678901234567890');
    expect(normalizeRobloxPlaceId('https://www.roblox.com/games/123/My-Game')).toBe('123');
    expect(normalizeRobloxPlaceId('')).toBeNull();
  });
  it('rejects non-game URLs and credentials or tracking', () => {
    ['0', '01', 'http://www.roblox.com/games/123', 'https://www.roblox.com.evil.test/games/123', 'https://user@www.roblox.com/games/123', 'https://www.roblox.com/games/123?token=secret', 'https://www.roblox.com/games/123#token', 'https://create.roblox.com/dashboard', 'https://www.roblox.com/share?code=secret'].forEach((input) => expect(() => normalizeRobloxPlaceId(input)).toThrow());
  });
});
