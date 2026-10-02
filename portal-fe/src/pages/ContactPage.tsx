import GNB from '../components/GNB';
import Footer from '../components/Footer';
import { portalTitle, portalUrl } from '../seo/copy.mjs';
import { useSeo } from '../seo/useSeo';
import { useHeritageSurface } from '../hooks/useHeritageSurface';
import { useReveal } from '../hooks/useReveal';
import './PrivacyPage.css';

/** 개인정보처리방침 8항과 같은 주소다 — 바꾸면 두 곳을 함께 고친다. */
const CONTACT_EMAIL = '1989v@naver.com';

/**
 * 연락처. 문의 창구는 메일 하나뿐이고, 무엇을 적어 보내면 빨리 처리되는지를 적는다.
 * 모든 호스트에서 같은 주소(apex `/contact`)를 가리킨다 — 방침과 같은 이유.
 */
export default function ContactPage() {
  useHeritageSurface();
  const reveal = useReveal();
  useSeo({
    title: portalTitle('연락처'),
    description: '1989v.com 운영자에게 정보 정정·저작권·개인정보·제휴를 문의하는 방법입니다.',
    canonical: portalUrl('/contact'),
  });

  return (
    <>
      <GNB items={[{ label: '홈', href: '/' }]} />
      <div className="privacy-page">
        <div className="privacy-inner">
          <header className="privacy-header kh-stagger" ref={reveal}>
            <h1 className="privacy-title kh-seep">연락처</h1>
          </header>

          <article className="privacy-body">
            <section className="privacy-section">
              <h2>메일</h2>
              <p>
                <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> — 운영자 권기덕
              </p>
              <p>개인이 운영하는 사이트라 전화 창구는 없습니다. 받은 메일은 확인 후 회신합니다.</p>
            </section>

            <section className="privacy-section">
              <h2>이런 문의를 받습니다</h2>
              <ul>
                <li>
                  <strong>정보 정정</strong> — 관광지·행사 정보가 실제와 다를 때. 페이지 주소와
                  틀린 항목을 적어 주세요. 공공데이터에서 온 값은 원천 기관에도 함께 알리면 다음
                  수집 때 반영됩니다.
                </li>
                <li>
                  <strong>저작권·출처</strong> — 사진이나 글의 권리 문제, 출처 표시 누락.
                </li>
                <li>
                  <strong>개인정보</strong> — 열람·정정·삭제 요청. 처리 기준은{' '}
                  <a href="/privacy">개인정보처리방침</a>에 있습니다.
                </li>
                <li>
                  <strong>제휴·광고</strong> — 혜택 모음 등록이나 협업 제안.
                </li>
                <li>
                  <strong>오류 신고</strong> — 화면이 깨지거나 게임이 멈출 때. 기기·브라우저와
                  주소를 적어 주세요.
                </li>
              </ul>
            </section>

            <section className="privacy-section">
              <h2>사이트 소개</h2>
              <p>
                운영 주체와 데이터 출처는 <a href="/about">사이트 소개</a>에 있습니다.
              </p>
            </section>
          </article>
        </div>
        <Footer />
      </div>
    </>
  );
}
