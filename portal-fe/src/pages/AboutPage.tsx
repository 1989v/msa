import GNB from '../components/GNB';
import Footer from '../components/Footer';
import { PORTAL_PAGES, portalTitle, portalUrl } from '../seo/copy.mjs';
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
            <section className="privacy-section">
              <h2>운영</h2>
              <p>
                1989v.com 과 하위 도메인은 백엔드 개발자 권기덕이 개인으로 운영합니다. 회사나
                단체의 사이트가 아니며, 설계부터 운영까지 한 사람이 맡습니다.
              </p>
              <p>
                문의는 <a href="/contact">연락처</a> 페이지에 있습니다.
              </p>
            </section>

            <section className="privacy-section">
              <h2>서비스</h2>
              <ul>
                <li>
                  <a href="https://place.1989v.com/">관광정보</a> — 전국 관광지·축제·숙박·여행코스와
                  날씨·대기질·혼잡 예측
                </li>
                <li>
                  <a href="https://blog.1989v.com/">블로그</a> — 개발과 운영 기록
                </li>
                <li>
                  <a href="/games">게임</a> — 브라우저에서 바로 하는 웹게임
                </li>
                <li>
                  <a href="https://deal.1989v.com/">혜택 모음</a> — 분류별 혜택 링크
                </li>
                <li>
                  <a href="https://rank.1989v.com/">랭킹</a> — 공개 데이터로 줄 세운 순위
                </li>
                <li>
                  <a href="/tech">기술 사전</a> — 개발 개념과 서비스 구조
                </li>
              </ul>
            </section>

            <section className="privacy-section">
              <h2>데이터 출처</h2>
              <ul>
                <li>관광정보는 한국관광공사 등의 공공데이터를 매일 받아 값을 고치지 않고 보여 줍니다.</li>
                <li>원천의 값이 바뀌면 다음 수집 때 함께 바뀝니다. 요금·운영 시간은 방문 전에 해당 기관에 확인해 주세요.</li>
                <li>원천과 라이선스 전체 목록은 <a href="/data-sources">데이터 출처</a>에 있습니다.</li>
              </ul>
            </section>

            <section className="privacy-section">
              <h2>광고와 제휴</h2>
              <p>
                일부 페이지에 Google AdSense 광고가 실립니다. 혜택 모음의 일부 링크는 제휴
                링크이며, 해당 링크에는 그 사실을 따로 표시합니다. 광고와 제휴는 관광정보의 내용과
                순서에 영향을 주지 않습니다.
              </p>
              <p>
                수집하는 정보와 쿠키는 <a href="/privacy">개인정보처리방침</a>에 있습니다.
              </p>
            </section>
          </article>
        </div>
        <Footer />
      </div>
    </>
  );
}
