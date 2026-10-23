import { createContext } from 'react';

export const InstallContext = createContext<{ hidden: boolean; install: () => void }>({ hidden: true, install: () => {} });

/** Path only: queries/fragments may contain OAuth, invitations, precise location or searches. */
export function installPath(pathname: string): string {
  try {
    // encodeURIComponent leaves parentheses literal; canonicalize these safe name characters.
    pathname = pathname.replace(/[()]/g, char => char === '(' ? '%28' : '%29');
    const decoded = decodeURIComponent(pathname);
    if (pathname.length > 512 || !/^\/(?!\/)[A-Za-z0-9/_~.%-]*$/.test(pathname)
      || !/^\/(?!\/)[A-Za-z0-9가-힣/_~. ()-]*$/.test(decoded)
      || /%(?!20|28|29)[0-7]/i.test(pathname) || decoded.includes('//') || /(?:^|\/)\.{1,2}(?:\/|$)/.test(decoded)
      || /^(?:\/(resume|d|oauth|shared)(\/|$)|\/(?:en\/)?party\/)/i.test(decoded)) return '/';
    return pathname;
  } catch { return '/'; }
}

/** Nginx does not URL-decode $arg_*. Fixed 16 UTF-16 units become JSON \uXXXX escapes. */
export function installName(title: string): string {
  const short = Array.from(title.split(/\s+[|—]\s+/)[0]).filter(char => char.charCodeAt(0) >= 32 && !(char.charCodeAt(0) >= 127 && char.charCodeAt(0) <= 159)).join('').trim().slice(0, 16).replace(/[\uD800-\uDBFF]$/, '').padEnd(16, ' ');
  return Array.from({ length: 16 }, (_, i) => short.charCodeAt(i).toString(16).padStart(4, '0')).join('');
}

/** Device signals include tablets and iPadOS, without treating a narrow PC window as mobile. */
export function isMobileInstallDevice(device: Pick<Navigator, 'userAgent' | 'platform' | 'maxTouchPoints'> & { userAgentData?: { mobile?: boolean } }): boolean {
  return /Android|iPhone|iPad|iPod/i.test(device.userAgent)
    || (device.platform === 'MacIntel' && device.maxTouchPoints > 1)
    || device.userAgentData?.mobile === true;
}
