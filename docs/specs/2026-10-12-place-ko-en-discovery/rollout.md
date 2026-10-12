<!-- source: portal-fe/src/seo/copy.mjs, portal-fe/scripts/prerender-seo.mjs, docs/specs/2026-10-12-place-ko-en-discovery/implementation.md -->
# 운영 배포·Google 후속 요청

## 승인과 범위

사용자가 ‘둘 다 해’로 운영 배포와 Google 후속 요청 묶음을 승인했다. 기존 main·OCI portal-fe 경로로 배포하고, Chrome Google Search Console에서 관광 영문 홈·서울·제주·부산 실제 검사 후 색인 가능하면 각각 1회 요청, 게임 noindex 6개 리포트는 수정 결과 확인 1회를 수행한다. 네이버 인증·제출·추가 URL·사이트 설정 변경은 포함하지 않는다.

## 운영 배포

- 최초 배포 소스: `31dddb456312709c7213a8f6a5b06685271a872d`.
- [이미지 workflow 38265813506](https://github.com/1989v/msa/actions/runs/38265813506): success.
- 최초 운영 이미지: `portal-fe:31dddb4`, Ready 1/1. 이후 main의 광고 드릴 참조 수정까지 포함한 **`portal-fe:6a861be`, Ready 1/1**로 갱신됐다. 관광 본문 변경은 유지된다.
- `kubectl -n commerce rollout status deployment/portal-fe --timeout=45s`: **deployment "portal-fe" successfully rolled out**.
- 배포 대기 중 기존 ArgoCD 애플리케이션의 normal refresh를 사용했다. 전체 애플리케이션의 다른 건강 상태를 수정하거나 강제 배포하지 않았다.
- 배포 과정에서 다른 작업이 main에 추가됐다. 소스 CI 38265813317은 새 main CI로 대체되어 cancelled이며, 이 실행의 portal-fe 타입·테스트·Kustomize·YAML은 success였다. 후속 main CI의 상태는 별도 기록한다. 취소된 전체 실행을 성공으로 보고하지 않는다.
- 후속 main `8644c7028`의 [CI 38266270304](https://github.com/1989v/msa/actions/runs/38266270304)는 `:code-dictionary:feature:test`의 `DrillExportSpec.kt:53`에서 실패했다. 광고 온톨로지가 공유 `copy.mjs`의 코드 줄 위치를 참조해, 관광 소개 등 공유 파일 변경으로 줄 번호가 이동하면 재생성한 기술 드릴 JSON과 저장된 파일이 어긋나는 의존성이 있었다. 처음 이를 관광 변경과 완전히 별개인 실패로 설명한 것은 정정한다.
- [수정 커밋 6a861be](https://github.com/1989v/msa/commit/6a861be8b562fd22dc196ffa823103177f876196)는 광고 참조를 실제 `adsenseLoader.ts`로 옮기고 파생 데이터를 갱신했다. 테스트를 약화하지 않고 해결했으며, 해당 커밋의 [전체 CI 38267619331](https://github.com/1989v/msa/actions/runs/38267619331)와 [이미지 빌드 38267619418](https://github.com/1989v/msa/actions/runs/38267619418)는 모두 **success**다.

## 운영 HTTP 검증

명시적 gpt-6.1-sol worker가 읽기 전용으로 수행했다. 기존 게임 noindex 대상 6개는 2026-10-12 23:51:59 KST, 최초 관광 8URL은 2026-10-13 00:00:28 KST에 확인했다. 운영 이미지가 바뀌어 **최종 6a861be에서 동일 관광 8URL을 2026-10-13 00:23:02 KST에 한 번 재확인**했고 모두 통과했다. 각 검사 exit 0 / pass true.

- 게임 6개: HTTP 200, 자기 URL canonical 1개, H1 1개, noindex 없음.
- 관광 ko/en 홈·지역 11/50/26 총 8URL: HTTP 200, 자기 URL canonical/H1 각각 1개, noindex 없음, ko/en/x-default 정상.
- 관광 홈 공유 소개 2/2, 지역 전체 소개·확정 안내 6/6 일치. 지역 본문에는 메타용 생략 기호가 전파되지 않았다.
- 실제 지역 API 수량과 일치: ko 서울 1,474·제주 787·부산 536 / en 서울 395·제주 182·부산 132.
- 각 언어 홈의 지역 16개·관광지 60개 링크, 각 지역의 대표 관광지 10개·자식 지역·홈 링크 유지.

이 검증은 현재 운영 HTML·실제 API를 대조한 것이며 Google 최종 색인·순위 검증이 아니다. 서버·파일 변경과 브라우저 자동화 없이 수행했다.

## Google 후속 요청

게임 noindex 6개 리포트에서 ‘수정 결과 확인’을 **1회 제출**했고 **유효성 검사 상태: 시작됨 / 시작된 날짜: 2026-10-12**를 확인했다. 이미 시작된 Soft 404 18개 검증을 다시 누르지 않았다.

| 관광 영문 URL | 실제 테스트 | 색인 요청 |
|---|---|---|
| `/en` | 10/13 00:01 색인 가능 | 요청됨·우선순위 크롤링 대기열 추가 확인 |
| `/en/regions/11` | 10/13 00:05 색인 가능 | 요청됨·우선순위 크롤링 대기열 추가 확인 |
| `/en/regions/50` | 10/13 00:09 색인 가능 | 요청됨·우선순위 크롤링 대기열 추가 확인 |
| `/en/regions/26` | 저장된 검사에서 이미 색인됨. 10/13 00:14 새 실제 검사도 색인 가능 | 요청됨·우선순위 크롤링 대기열 추가 확인 |

영문 관광 URL 4개 모두 실제 검사에서 색인 가능을 확인한 뒤 각각 요청 버튼을 1회 눌렀고, **‘색인 생성 요청됨’·‘우선순위 크롤링 대기열에 추가’** 확인 화면을 보았다. 게임 6개 재검증과 합쳐 승인된 Google 후속 요청은 모두 접수/시작을 확인했다. CAPTCHA 해결 조작·네이버 인증·추가 URL 요청은 없었다.

승인된 컴퓨터 유즈 묶음은 이 확인을 끝으로 완료·종료했다. 추가 앱/사이트/조회/제출에 승인 범위를 자동 재사용하지 않는다. 새 본문의 최종 재색인·검색 순위 상승·관광 전체 Soft 404 해소는 아직 확인되지 않았다. 부산의 기존 색인 상태와 나머지 페이지의 향후 색인 결과를 구분한다.
