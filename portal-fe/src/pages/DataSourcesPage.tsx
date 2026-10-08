import GNB from '../components/GNB';
import Footer from '../components/Footer';
import { PORTAL_PAGES, portalUrl } from '../seo/copy.mjs';
import { DATA_SOURCES, DATA_SOURCE_NOTICES } from '../seo/dataSources.mjs';
import { useSeo } from '../seo/useSeo';
import { useHeritageSurface } from '../hooks/useHeritageSurface';
import { useReveal } from '../hooks/useReveal';
import './PrivacyPage.css';

/**
 * 데이터 출처 — 사이트가 쓰는 외부 데이터의 원천과 라이선스.
 *
 * 목록은 `seo/dataSources.mjs` 상수 하나에서 온다(원본은 원천 대장 §1). 프리렌더도 같은 상수를
 * 쓴다. 모든 호스트에서 같은 주소(apex `/data-sources`)를 가리킨다 — 방침과 같은 이유.
 */
export default function DataSourcesPage() {
  useHeritageSurface();
  const reveal = useReveal();
  const meta = PORTAL_PAGES['/data-sources'];
  useSeo({ title: meta.title, description: meta.description, canonical: portalUrl('/data-sources') });

  return (
    <>
      <GNB items={[{ label: '홈', href: '/' }]} />
      <div className="privacy-page">
        <div className="privacy-inner">
          <header className="privacy-header kh-stagger" ref={reveal}>
            <h1 className="privacy-title kh-seep">데이터 출처</h1>
          </header>

          <article className="privacy-body">
            <section className="privacy-section">
              <p>
                관광정보·날씨·대기질·지역 이름 등은 아래 원천에서 받아 값을 고치지 않고 보여 줍니다.
                원천의 값이 바뀌면 다음 수집 때 함께 바뀝니다.
              </p>
              <table className="kh-table privacy-table">
                <thead>
                  <tr>
                    <th>데이터</th>
                    <th>원천</th>
                    <th>라이선스</th>
                    <th>비고</th>
                  </tr>
                </thead>
                <tbody>
                  {DATA_SOURCES.map((row) => (
                    <tr key={row.data}>
                      <td>{row.data}</td>
                      <td>{row.source}</td>
                      <td>{row.license}</td>
                      <td>{row.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="privacy-section">
              <h2>라이선스 고지</h2>
              <ul>
                {DATA_SOURCE_NOTICES.map((notice) => (
                  <li key={notice.text}>
                    {notice.text}
                    {notice.href && (
                      <>
                        {' '}
                        <a href={notice.href} target="_blank" rel="noopener noreferrer">
                          {notice.label}
                        </a>
                      </>
                    )}
                  </li>
                ))}
              </ul>
              <p className="privacy-note">
                운영 주체는 <a href="/about">사이트 소개</a>, 정정 요청은 <a href="/contact">연락처</a>에 있습니다.
              </p>
            </section>
          </article>
        </div>
        <Footer />
      </div>
    </>
  );
}
