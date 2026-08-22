import GNB from '../components/GNB';
import Footer from '../components/Footer';
import { portalTitle, portalUrl } from '../seo/copy.mjs';
import { useSeo } from '../seo/useSeo';
import { useHeritageSurface } from '../hooks/useHeritageSurface';
import { useReveal } from '../hooks/useReveal';
import './PrivacyPage.css';

/** 개정일 — 본문을 고치면 반드시 함께 올린다. 방침은 '언제부터의 약속인지'가 내용의 일부다. */
const EFFECTIVE_DATE = '2026-08-22';
const CONTACT_EMAIL = '1989v@naver.com';

/**
 * 개인정보처리방침.
 *
 * 광고를 붙이려면 있어야 하는 문서다(ADR-0076). 다만 심사 통과가 목적인 형식 문서가
 * 아니라 **실제로 무엇을 받는지**를 적는다 — GA·AdSense·지도는 각각 다른 것을 가져가고,
 * 이력서 호스트는 광고도 분석도 싣지 않는다는 것이 이 사이트의 실제 동작이다.
 *
 * 본문을 마크다운으로 두지 않는 이유: 원본이 DB 도 어드민도 아니라 이 파일 하나뿐인데
 * 파서를 끼우면 렌더 경로만 길어진다. 대신 개정일을 상수로 올려 갱신을 강제한다.
 *
 * 모든 호스트에서 같은 주소(apex `/privacy`)를 가리킨다. 호스트마다 방침을 따로 두면
 * 한 곳만 고쳐진 채로 남는다.
 */
export default function PrivacyPage() {
  useHeritageSurface();
  const reveal = useReveal();
  useSeo({
    title: portalTitle('개인정보처리방침'),
    description:
      '1989v.com 과 하위 서비스가 수집하는 정보, 사용하는 쿠키와 제3자 도구, 보관 기간과 이용자의 선택권을 정리한 문서입니다.',
    canonical: portalUrl('/privacy'),
  });

  return (
    <>
      <GNB items={[{ label: '홈', href: '/' }]} />
      <div className="privacy-page">
        <div className="privacy-inner">
          <header className="privacy-header kh-stagger" ref={reveal}>
            <span className="kh-section-label kh-seep">Privacy</span>
            <h1 className="privacy-title kh-seep">개인정보처리방침</h1>
            <p className="privacy-effective kh-mono kh-seep">시행일 {EFFECTIVE_DATE}</p>
          </header>

          <article className="privacy-body">
            <section className="privacy-section">
              <h2>1. 이 방침이 적용되는 범위</h2>
              <p>
                이 방침은 <strong>1989v.com</strong> 과 그 하위 서비스에 적용됩니다 —
                게임(game), 관광지 검색(place), 블로그(blog), 혜택 링크(deal), 스토어(/shop),
                개념 사전(/tech).
              </p>
              <p>
                이력서 호스트(resume)는 <strong>예외</strong>입니다. 열람 자체가 제한된 문서라
                광고도 분석 도구도 싣지 않으며, 아래 4항의 제3자 도구가 그 화면에서는
                동작하지 않습니다.
              </p>
            </section>

            <section className="privacy-section">
              <h2>2. 수집하는 정보</h2>
              <p>
                <strong>
                  IP 주소와 브라우저 정보 원문은 데이터베이스에 저장하지 않습니다.
                </strong>{' '}
                방문자 구분에는 브라우저에 저장되는 <em>무작위 번호</em>만 씁니다. 이 번호는
                누구인지 알려주지 않으며, 브라우저에서 쿠키와 저장소를 지우면 그 즉시 이전
                기록과의 연결이 끊깁니다.
              </p>
              <table className="kh-table privacy-table">
                <thead>
                  <tr>
                    <th>언제</th>
                    <th>무엇</th>
                    <th>왜</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>모든 방문</td>
                    <td>무작위 방문자 번호(쿠키)</td>
                    <td>같은 사람의 중복 조회를 한 번으로 세기 위해</td>
                  </tr>
                  <tr>
                    <td>글·게임·관광지 조회</td>
                    <td>무엇을 어느 날 봤는지 + 방문자 번호</td>
                    <td>조회수 집계</td>
                  </tr>
                  <tr>
                    <td>혜택 링크 클릭</td>
                    <td>어떤 링크를 언제, 들어온 사이트 주소, 브라우저 종류(예: Chrome)</td>
                    <td>어떤 혜택이 실제로 쓰이는지 파악</td>
                  </tr>
                  <tr>
                    <td>소셜 로그인</td>
                    <td>제공자 구분(Google·Kakao)과 계정 식별번호를 가린 값</td>
                    <td>다음 로그인 때 같은 회원임을 알아보기 위해</td>
                  </tr>
                  <tr>
                    <td>찜 · 평점 · 좋아요</td>
                    <td>대상 식별자와 시각</td>
                    <td>다시 볼 때 목록을 복원</td>
                  </tr>
                  <tr>
                    <td>블로그 댓글</td>
                    <td>작성 내용, 표시 이름, 작성 시각</td>
                    <td>댓글 표시</td>
                  </tr>
                  <tr>
                    <td>스토어 주문</td>
                    <td>주문 내역(데모 데이터)</td>
                    <td>주문 흐름 시연</td>
                  </tr>
                </tbody>
              </table>
              <p>
                IP 주소는 <strong>저장하지 않고</strong>, 짧은 시간 동안 과도한 요청을 막는
                용도로만 사용한 뒤 자동으로 사라집니다. 서버 접속 로그는 별도 저장소에
                적재하지 않으며 컨테이너가 교체되면 함께 사라집니다.
              </p>
              <p>
                <strong>소셜 로그인에서도 이메일과 실명을 받지 않습니다.</strong> 로그인 시
                요청하는 권한은 &lsquo;로그인&rsquo; 하나뿐이라 이메일·이름은 저희에게
                전달되지 않습니다. 계정 식별번호도 그대로 두지 않고 <em>되돌릴 수 없는 형태로
                바꿔서</em> 보관하므로, 저장된 값만으로는 어느 소셜 계정인지 알 수 없습니다.
                화면에 보이는 이름은 가입할 때 저희가 만들어 드리는 것이고 언제든 바꿀 수
                있습니다.
              </p>
            </section>

            <section className="privacy-section">
              <h2>3. 쿠키</h2>
              <p>쿠키는 세 가지 목적으로만 씁니다.</p>
              <ul>
                <li>
                  <strong>기능</strong> — 로그인 상태 유지, 밝은 화면/어두운 화면 선택 기억.
                </li>
                <li>
                  <strong>분석</strong> — 방문자 수와 유입 경로 집계(Google Analytics).
                </li>
                <li>
                  <strong>광고</strong> — 광고 게재와 중복 노출 방지(Google AdSense).
                </li>
              </ul>
              <p>
                브라우저 설정에서 쿠키를 차단할 수 있습니다. 기능 쿠키까지 막으면 로그인이
                유지되지 않습니다.
              </p>
            </section>

            <section className="privacy-section">
              <h2>4. 제3자 도구</h2>
              <p>
                아래 도구는 각 사업자가 직접 정보를 수집하며, 그 처리는 해당 사업자의 방침을
                따릅니다.
              </p>
              <table className="kh-table privacy-table">
                <thead>
                  <tr>
                    <th>도구</th>
                    <th>쓰는 곳</th>
                    <th>방침</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Google Analytics</td>
                    <td>이력서 호스트를 제외한 전 화면</td>
                    <td>
                      <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">
                        policies.google.com/privacy
                      </a>
                    </td>
                  </tr>
                  <tr>
                    <td>Google AdSense</td>
                    <td>이력서 호스트를 제외한 전 화면</td>
                    <td>
                      <a
                        href="https://policies.google.com/technologies/ads"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        policies.google.com/technologies/ads
                      </a>
                    </td>
                  </tr>
                  <tr>
                    <td>Google Maps</td>
                    <td>관광지 지도</td>
                    <td>
                      <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">
                        policies.google.com/privacy
                      </a>
                    </td>
                  </tr>
                </tbody>
              </table>
              <p>
                Google 을 포함한 제3자 공급업체는 쿠키를 사용해 이 사이트나 다른 사이트의 방문
                기록을 바탕으로 광고를 게재합니다. 맞춤 광고는{' '}
                <a
                  href="https://www.google.com/settings/ads"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Google 광고 설정
                </a>
                에서 끌 수 있고, 참여 업체 전반은{' '}
                <a href="https://www.aboutads.info/choices/" target="_blank" rel="noopener noreferrer">
                  aboutads.info
                </a>
                에서 한 번에 거부할 수 있습니다. 분석 수집만 막으려면{' '}
                <a
                  href="https://tools.google.com/dlpage/gaoptout"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Google Analytics 차단 부가기능
                </a>
                을 설치하면 됩니다.
              </p>
            </section>

            <section className="privacy-section">
              <h2>5. 외부로 나가는 링크</h2>
              <p>
                혜택 링크(deal) 화면의 일부 링크는 제휴 링크이며, 이동한 곳에서 구매가
                일어나면 수수료를 받습니다. 해당 링크에는 그 사실이 링크 옆에 표시됩니다.
                링크를 눌러 다른 사이트로 이동한 뒤의 개인정보 처리는 그 사이트의 방침을
                따릅니다.
              </p>
            </section>

            <section className="privacy-section">
              <h2>6. 보관과 파기</h2>
              <ul>
                <li>
                  <strong>회원 정보</strong> — 탈퇴 시 지체 없이 파기합니다.
                </li>
                <li>
                  <strong>댓글 · 찜 · 평점</strong> — 탈퇴 또는 삭제 요청 시 파기합니다.
                </li>
                <li>
                  <strong>방문자 번호</strong> — 쿠키 유효기간은 발급일로부터 1년입니다.
                  브라우저에서 지우면 그 즉시 사라집니다.
                </li>
                <li>
                  <strong>조회 · 클릭 기록</strong> — <strong>90일</strong> 보관 후
                  자동으로 삭제합니다. 매주 도는 정리 작업이 기간이 지난 기록을 지웁니다.
                </li>
                <li>
                  <strong>이력서 열람 기록</strong> — <strong>1년</strong> 보관 후 자동으로
                  삭제합니다. 어떤 공유 링크가 언제 열렸는지만 남고, 열람한 사람을 식별하는
                  정보는 기록하지 않습니다.
                </li>
                <li>
                  법령이 보관을 요구하는 기록은 그 기간을 따릅니다(전자상거래법의 계약·결제
                  기록 5년 등).
                </li>
              </ul>
            </section>

            <section className="privacy-section">
              <h2>7. 이용자의 권리</h2>
              <p>
                본인의 정보에 대해 <strong>열람·정정·삭제·처리 정지</strong>를 요구할 수
                있습니다. 아래 연락처로 요청하시면 확인 후 처리하고 결과를 알려드립니다.
                만 14세 미만 아동의 정보는 수집하지 않습니다.
              </p>
            </section>

            <section className="privacy-section">
              <h2>8. 문의</h2>
              <p>
                개인정보 보호책임자 — 권기덕 ·{' '}
                <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
              </p>
              <p className="privacy-note">
                이 방침이 바뀌면 시행일을 고쳐 이 페이지에 먼저 알립니다.
              </p>
            </section>
          </article>
        </div>
        <Footer />
      </div>
    </>
  );
}
