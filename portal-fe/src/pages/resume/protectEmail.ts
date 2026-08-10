const EMAIL_PATTERN = /([A-Za-z0-9._%+-]+)@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;

/**
 * 렌더된 HTML 안의 이메일 주소를 조각으로 분리한다.
 *
 * 실질 보호는 토큰 게이트와 noindex 이고 (ADR-0064), 이건 DOM 을 훑는 단순 수집기를 막는
 * 수준이다. 페이지가 전체공개일 때 API 응답에는 주소가 그대로 들어 있으므로 여기서 막을 수 없다.
 * 사람이 보고 클릭·복사하는 경험은 그대로 두는 것이 우선이다.
 */
export function protectEmails(html: string): string {
  return html.replace(EMAIL_PATTERN, (_match, user: string, domain: string) => {
    return `<a class="resume-email" href="#" data-u="${user}" data-d="${domain}" rel="nofollow"></a>`;
  });
}

/** 조각을 합쳐 실제 주소를 채운다. 인쇄본에도 그대로 남는다. */
export function hydrateEmails(root: HTMLElement | null): void {
  if (!root) return;
  root.querySelectorAll<HTMLAnchorElement>('a.resume-email').forEach((el) => {
    const user = el.dataset.u;
    const domain = el.dataset.d;
    if (!user || !domain) return;
    const address = `${user}@${domain}`;
    el.textContent = address;
    el.href = `mailto:${address}`;
  });
}
