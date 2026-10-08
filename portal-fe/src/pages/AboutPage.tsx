import GNB from '../components/GNB';
import Footer from '../components/Footer';
import { ABOUT_SECTIONS, PORTAL_PAGES, portalTitle, portalUrl } from '../seo/copy.mjs';
import { useSeo } from '../seo/useSeo';
import { useHeritageSurface } from '../hooks/useHeritageSurface';
import { useReveal } from '../hooks/useReveal';
import './PrivacyPage.css';

/**
 * 사이트 소개 — 누가 운영하고, 무엇을 보여 주며, 데이터는 어디서 오는지.
 *
 * 광고 심사는 운영 주체와 콘텐츠 출처를 사이트 안에서 찾을 수 있는지 본다(ADR-0076).
 * 출처 목록 전체는 `/data-sources` 페이지(상수 `seo/dataSources.mjs`, 원본은 원천 대장 §1)에 있고
 * 여기는 요약만 둔다. 문서 레이아웃은 개인정보처리방침과 같은 것을 쓴다.
 * 절의 글은 상수 `ABOUT_SECTIONS` 하나에서 온다 — 프리렌더가 같은 상수로 초기 HTML 을 그린다.
 *
 * 모든 호스트에서 같은 주소(apex `/about`)를 가리킨다 — 방침과 같은 이유.
 */
export default function AboutPage() {
  useHeritageSurface();
  const reveal = useReveal();
  useSeo({
    title: portalTitle('사이트 소개'),
    description: PORTAL_PAGES['/about'].description,
    canonical: portalUrl('/about'),
  });

  return (
    <>
      <GNB items={[{ label: '홈', href: '/' }]} />
      <div className="privacy-page">
        <div className="privacy-inner">
          <header className="privacy-header kh-stagger" ref={reveal}>
            <h1 className="privacy-title kh-seep">사이트 소개</h1>
          </header>

          <article className="privacy-body">
            {ABOUT_SECTIONS.map((section) => (
              <section className="privacy-section" key={section.heading}>
                <h2>{section.heading}</h2>
                {section.paragraphs.map((parts, i) => (
                  <p key={i}>
                    {parts.map((part, j) =>
                      typeof part === 'string' ? (
                        part
                      ) : (
                        <a key={j} href={part.href}>
                          {part.label}
                        </a>
                      ),
                    )}
                  </p>
                ))}
                {section.items && (
                  <ul>
                    {section.items.map((item) => (
                      <li key={item.href}>
                        <a href={item.href}>{item.label}</a> — {item.desc}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </article>
        </div>
        <Footer />
      </div>
    </>
  );
}
