export type Invitation = { kind: 'none' } | { kind: 'join'; code: string } | { kind: 'invalid' };
const CODE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;

function codeResult(value: string): Invitation {
  const code = value.trim().replace(/-/g, '').toUpperCase();
  return CODE.test(code) ? { kind: 'join', code } : { kind: 'invalid' };
}

/** Presence and cardinality are checked before parsing: an invalid invite is never a host. */
export function queryInvitation(search: string): Invitation {
  const values = new URLSearchParams(search).getAll('r');
  if (values.length === 0) return { kind: 'none' };
  return values.length === 1 ? codeResult(values[0]) : { kind: 'invalid' };
}

export function parseInvitation(input: string): Invitation {
  const value = input.trim();
  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      if (url.pathname === '/') {
        const result = queryInvitation(url.search);
        return result.kind === 'none' ? { kind: 'invalid' } : result;
      }
      const legacy = /^\/(?:en\/)?party\/([^/]+)\/?$/.exec(url.pathname);
      return legacy ? codeResult(decodeURIComponent(legacy[1])) : { kind: 'invalid' };
    } catch { return { kind: 'invalid' }; }
  }
  return codeResult(value);
}

export function rootInvitation(hostname: string, pathname: string, search: string): Invitation {
  const enabled = hostname.split('.')[0] === 'game' || ['localhost', '127.0.0.1', '[::1]'].includes(hostname);
  return enabled && pathname === '/' ? queryInvitation(search) : { kind: 'none' };
}

export async function shareInvitation(link: string): Promise<'shared' | 'cancelled' | 'failed'> {
  try { await navigator.share({ title: '함께 한 판', url: link }); return 'shared'; }
  catch (err) { return typeof err === 'object' && err !== null && 'name' in err && err.name === 'AbortError' ? 'cancelled' : 'failed'; }
}
