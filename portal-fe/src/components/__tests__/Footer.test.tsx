import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Footer from '../Footer';
import { TRUST_LINKS } from '../../seo/copy.mjs';

type TrustLink = { path: string; label: string; labelEn: string };

function trustAnchors(container: HTMLElement) {
  return [...container.querySelectorAll('.site-footer-copy a')].map((a) => ({
    href: a.getAttribute('href'),
    label: a.textContent,
  }));
}

describe('Footer 신뢰 링크', () => {
  it('국문 화면은 TRUST_LINKS 의 상대 경로·국문 라벨을 순서째 그린다', () => {
    const { container } = render(<Footer />);
    expect(trustAnchors(container)).toEqual(
      (TRUST_LINKS as TrustLink[]).map((t) => ({ href: t.path, label: t.label })),
    );
  });

  it('영문 화면은 같은 경로에 영문 라벨을 단다', () => {
    const { container } = render(<Footer lang="en" />);
    expect(trustAnchors(container)).toEqual(
      (TRUST_LINKS as TrustLink[]).map((t) => ({ href: t.path, label: t.labelEn })),
    );
  });
});
