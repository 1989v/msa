import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearLocalSession, getUserId } from '../auth';
import { useAuth } from '../useAuth';
import { logoutApi } from '../../api/shopApi';

vi.mock('../../api/shopApi', () => ({ logoutApi: vi.fn(async () => undefined) }));

afterEach(() => { clearLocalSession(); localStorage.clear(); vi.clearAllMocks(); });

describe('HttpOnly session changes notify game profile ownership', () => {
  it('announces login only after the server has set the member marker', () => {
    const { result } = renderHook(useAuth);
    const owners: (string | null)[] = [];
    const changed = () => owners.push(getUserId());
    window.addEventListener('portal-auth-changed', changed);
    try {
      document.cookie = 'portal_user_id=member-b; Path=/';
      act(() => result.current.login());
      expect(owners).toEqual(['member-b']);
      expect(result.current.isLoggedIn).toBe(true);
      expect(localStorage.getItem('portal_auth_revision')).not.toBeNull();
    } finally { window.removeEventListener('portal-auth-changed', changed); }
  });

  it('clears the member marker before announcing server logout completion', async () => {
    document.cookie = 'portal_user_id=member-a; Path=/';
    const { result } = renderHook(useAuth);
    const owners: (string | null)[] = [];
    const changed = () => owners.push(getUserId());
    window.addEventListener('portal-auth-changed', changed);
    try {
      await act(async () => { await result.current.logout(); });
      expect(logoutApi).toHaveBeenCalledTimes(1);
      expect(owners).toEqual([null]);
      expect(result.current.isLoggedIn).toBe(false);
    } finally { window.removeEventListener('portal-auth-changed', changed); }
  });
});
