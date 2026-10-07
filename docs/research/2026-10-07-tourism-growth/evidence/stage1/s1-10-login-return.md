측정 시각: 2026-10-08 04:32:41–04:32:49 KST | 도구: Node.js v22.22.3, Google Chrome 154.0.8037.98, Python 3.14.6(urllib) | 표본: HTTP 2 URL, Chrome 기동 2회, 완료한 별 클릭 0회, 로그인 0회 | 명령: `git ls-tree -r origin/main --name-only | grep …`, `git show origin/main:<path> | nl -ba`, `node <<'NODE'`(CDP pipe), `python3 <<'PY'`(urllib GET), `pgrep -fl "Google Chrome.*headless"`

# S1-10 — 로그인 복귀 경로와 비로그인 구간

**결론: origin/main 코드에서는 상세 URL의 장소 ID는 복귀 경로에 남지만, 허브 검색 조건·허브 선택 장소·로그인 전 저장 의도는 보관하지 않는다. 실제 로그인 복귀 완주는 미확인이다.** 비로그인 클릭 실측도 Chrome 기동 실패로 미확인이다. 아래 URL은 실제 클릭 결과가 아니라 코드로 계산한 값이다.

## 범위와 증거 기준

- 기준 커밋: `origin/main` = `a8d1c97ef498ca8d7f30327abbf0fbeb20be7a24`. 로컬 main 소스는 읽지 않았다.
- 코드 경로의 사실과 배포 사이트의 사실을 구분한다. 배포 번들이 위 커밋과 동일한지는 **미확인**이다.
- 로컬 소스 수정, git add/commit/push/stash, kubectl, ssh, 운영 DB, 사내 도구 접근, 계정 로그인·생성은 하지 않았다.
- 외부 HTTP는 공개 place의 2회 GET만 완료했다. 브라우저 계측은 CDP 응답 전에 실패했고 요청 계수 `sent=0, paused=0`이었다. 이 계수는 CDP 계측 범위이며 브라우저 내부 통신 전체를 입증하는 패킷 캡처는 아니다(**미확인**).

## origin/main 코드 경로

라인은 모두 위 기준 커밋의 파일에 대한 번호다. 소스 확인 명령은 `git show origin/main:<아래 경로> | nl -ba`다.

| 단계 | 코드 근거 | 판정 |
|---|---|---|
| 상세의 찜 대상 | `portal-fe/src/pages/place/AttractionPage.tsx:113–122,386` | URL `:id`로 관광지를 다시 조회하며 `FavoriteButton`에 `ATTRACTION`, `attraction.id`를 전달한다. |
| 비로그인 별 클릭 | `portal-fe/src/components/favorite/FavoriteButton.tsx:68–77` | 기본 링크 이동·이벤트 전파를 막고 `window.location.href = buildLoginHref()` 후 return. targetKey를 복귀 URL에 추가하거나 저장하지 않으며 toggle도 하지 않는다. |
| apex 로그인 URL | `portal-fe/src/auth/auth.ts:123–127`, `portal-fe/src/seo/copy.mjs:19` | 기본 next는 현재 `window.location.href` 전체다. 생산 호스트에서는 `https://1989v.com/login?next=` 뒤에 절대 URL을 인코딩한다. 기존 주소에 있는 쿼리·hash는 포함하지만 검색 상태를 새로 직렬화하지 않는다. |
| next 검증 | `portal-fe/src/auth/auth.ts:102–115` | `/`로 시작하는 상대 경로(단 `//` 제외) 또는 HTTPS의 apex/1989v 서브도메인 URL을 허용한다. 거절 시 null. 검색 상태나 저장 의도를 만드는 함수가 아니다. |
| 로그인 화면 | `portal-fe/src/pages/LoginPage.tsx:10–16,32–39,50` | next를 safeNext로 검증. OAuth 제공자 버튼을 누를 때 apex sessionStorage의 `portal_login_next`에 next만 보관한다. 로그인 화면 진입만으로 보관하지 않는다. 이미 로그인한 경우 `location.replace(next ?? '/')`. |
| OAuth 시작·콜백 | `portal-fe/src/auth/auth.ts:90–92,144–166`; `portal-fe/src/pages/ShopOAuthCallbackPage.tsx:23–41` | OAuth state는 apex sessionStorage에 저장·소비한다. 유효한 code/state 뒤 로그인 API → login() → 저장된 next 재검증·삭제 → `location.replace(next ?? '/')`. |
| 로그인 API·후처리 | `portal-fe/src/api/shopApi.ts:625–637`; `portal-fe/src/auth/useAuth.ts:16–20` | POST `/api/auth/login/{provider}` 이후 인증 상태 갱신. 이 경로에는 찜 자동 저장 호출이 없다. |
| 로그인 후 찜 API | `portal-fe/src/components/favorite/useFavorites.ts:19–31`; `portal-fe/src/api/wishlistApi.ts:47–55,78–80` | 로그인 상태에서 keys 조회를 활성화한다. 사용자가 별을 눌러 toggle할 때 현재 keys에 따라 PUT `/api/v1/wishlist/ATTRACTION/{targetKey}` 또는 DELETE를 호출한다. 로그인 전 클릭을 재실행하는 대기 큐가 없다. |
| 허브 검색 상태 | `portal-fe/src/pages/place/PlacePage.tsx:241–268,279–305,854–858` | 검색어·분류·속성·지역·좌표/반경·페이지·selectedId는 useState. 검색 API 쿼리는 만들지만 브라우저 URL이나 sessionStorage에 검색 상태를 보관·복원하지 않는다. `useLocation`은 pathname만 사용한다(223–226). |
| 허브 장소 선택 | `portal-fe/src/pages/place/PlacePage.tsx:1201,1304,1347–1351,1368` | 카드 좌클릭은 기본 이동을 막고 selectedId만 변경. 패널 별/카드 별 모두 현재 허브 URL로 로그인한다. 카드의 상세 href를 next로 전달하지 않는다. |

`git grep -n -E 'LOGIN_NEXT_KEY|portal_login_next|pendingFavorite|favoriteIntent' origin/main -- portal-fe/src`로 복귀키 사용처도 확인했다. 저장 의도 부재 판정은 이름 검색만이 아니라 FavoriteButton → useFavorites → 로그인 완료 경로를 직접 읽은 결과다. 블로그의 별도 복귀키 사용처는 이번 관광지 흐름에 포함하지 않았다.

### 코드로 계산한 이동 URL (실측 아님)

- 상세 `https://place.1989v.com/attractions/1`에서 별 클릭:
  `https://1989v.com/login?next=https%3A%2F%2Fplace.1989v.com%2Fattractions%2F1`
  디코딩한 next = `https://place.1989v.com/attractions/1`.
- 허브 `/`에서 검색어 `궁`, 분류 `history`를 적용하고 카드 또는 선택 패널의 별 클릭:
  `https://1989v.com/login?next=https%3A%2F%2Fplace.1989v.com%2F`
  디코딩한 next = `https://place.1989v.com/`. 검색어·분류·selectedId는 실리지 않는다.
- 두 흐름 모두 apex 진입 방식은 같으나 next는 서로 다르다. 허브에서 먼저 고유 상세 페이지를 열면 next에는 그 상세 ID가 남지만 이전 허브 조건은 추가되지 않는다.

## 비로그인 측정 결과

### Chrome 시도 및 제한

첫 시도는 Node child_process로 다음 실행 파일을 직접 기동하고 fd 3/4의 CDP pipe로 제어했다. 일반 브라우저 UA를 사용하고 요청 인터셉터는 place/api의 GET/HEAD/OPTIONS만 250ms 간격으로 허용하도록 구성했다(최대 4건/초, 상한 1,900건). apex 로그인 요청·제3자 요청·쓰기 요청은 전송 전에 차단하도록 구성했으나, CDP 연결 자체가 실패해 이 인터셉터는 실제로 활성화되지 않았다.

```text
/Applications/Google Chrome.app/Contents/MacOS/Google Chrome
--headless=new --remote-debugging-pipe --user-data-dir=<독립 임시 디렉토리>
--no-first-run --no-default-browser-check --disable-background-networking
--disable-component-update --disable-sync --disable-extensions --disable-quic
--user-agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36"
about:blank
```

첫 시도 출력: `MEASUREMENT_ERROR Error: CDP timeout Target.createTarget`, `COUNTS {"sent":0,"paused":0,"blocked":0}`. 진단용 두 번째 시도는 같은 실행 파일에 `--headless=new --remote-debugging-pipe --user-data-dir=<별도 임시 디렉토리> --no-first-run --disable-background-networking about:blank`를 주었으며 `CHROME_EXIT null SIGABRT`를 반환했다. 진단은 about:blank에서 종료했고 공개 사이트 탐색도 시작하지 않았다.

두 명령 모두 같은 명령 내부에서 생성한 Chrome PID에 SIGTERM, 필요 시 SIGKILL을 보내는 정리 코드를 실행하고 끝에 `pgrep -fl "Google Chrome.*headless"`를 실행했다. 결과는 다음과 같다.

```text
sysmon request failed with error: sysmond service not found
pgrep: Cannot get process list
```

**잔류 0 확인: 미확인.** pgrep 종료 코드는 3이었다. SIGABRT로 종료한 진단 프로세스는 exit 이벤트로 확인했지만 전역 프로세스 목록을 확인하지 못했다. 사용자 Chrome과 MCP 프로필은 접근하지 않았다. 독립 프로필 경로는 각각 OS 임시 디렉토리의 `s1-10-chrome-gnhWZI`, `s1-10-diag-*`이며 프로필 생성 외 별도 측정 파일은 쓰지 않았다.

따라서 상세 별 클릭, 허브 검색어·필터 적용, 패널 선택 후 별 클릭, 실제 이동 URL/next, 클릭 시 wishlist 요청 여부는 모두 **미확인**이다. 기동 실패 원인은 **미확인**이며 sandbox 문제라고 단정하지 않는다.

### 공개 HTTP 보조 확인 (클릭 측정 대체 불가)

Python urllib.request로 아래 두 URL을 순차 GET했다. 요청 사이 0.3초 대기, timeout 25초, 위 일반 브라우저 UA를 지정했다. 반환 HTML의 외부 script·이미지는 요청하지 않았다.

| URL | HTTP 상태 | 최종 URL | HTML 바이트 | title | 별 마크업 |
|---|---:|---|---:|---|---|
| `https://place.1989v.com/attractions/1` | 200 | 요청 URL과 동일 | 15,259 | 경복궁 관광 정보 — 가는 길 · 주변 가볼 만한 곳 | K-관광 | `favorite-btn` 문자열 없음 |
| `https://place.1989v.com/` | 200 | 요청 URL과 동일 | 15,682 | 한국 관광지 검색 — 지역별 가볼 만한 곳·여행지 지도 | K-관광 | `favorite-btn` 문자열 없음 |

두 HTML은 `/assets/index-C5A32Ajr.js`를 참조했다. JS를 렌더하지 않았으므로 HTML의 별 문자열 부재는 사용자 화면에 별이 없다는 증거가 아니다. 위 title은 HTTP 응답에서 확인한 사실이며 실제 렌더·API 성공·로그인 복귀를 입증하지 않는다.

## 복귀 시 보존/복원 판정

아래는 **origin/main 코드 판정**이다. 실제 로그인 후 결과는 전부 미확인이다.

| 항목 | 분류 | 코드 판정 | 실제 검증 |
|---|---|---|---|
| 상세의 선택 장소 ID | 복원되는 것 | 상세 URL의 `/attractions/1`을 next로 보관하고 복귀 후 해당 ID를 재조회한다. 기존 UI 상태 스냅샷을 복원하는 것은 아니다. | 미확인 |
| 경로상의 언어, 기존 URL 쿼리/hash 문자열 | 복원되는 것 | href 전체가 next에 남는다. 쿼리 문자열이 남는 것과 화면이 이를 해석하는 것은 별개다. | 미확인 |
| 허브 검색어·분류·속성·지역·좌표/반경·페이지 | 안 되는 것 | useState만 있고 URL/스토리지 직렬화·복원 경로가 없다. 새 문서로 복귀하면 초기값과 초기 지역 선택 로직부터 시작한다. | 미확인 |
| 허브 카드/패널의 선택 장소 | 안 되는 것 | selectedId는 메모리 상태이고 next는 허브 URL뿐이다. 카드 상세 href도 전달하지 않는다. | 미확인 |
| 로그인 전 “이 관광지를 저장” 의도 | 안 되는 것 | 비로그인 클릭은 로그인 이동만 한다. 대상·동작 보관 및 로그인 완료 후 재실행이 없어 복귀 후 다시 별을 눌러야 한다. | 미확인 |
| 라우터 state를 통한 허브 복원 | 안 되는 것 | 호스트 이동은 location.href/replace이며 로그인 경로에서 state를 전달하지 않는다. 허브도 location.state를 읽지 않는다. | 미확인 |
| 기존에 서버에 저장된 찜 | 복원되는 것 | 인증된 복귀 화면에서 keys 조회로 기존 찜 상태를 다시 그리는 경로가 있다. 로그인 전 새 저장 의도와는 다르다. | 미확인 |
| 배포 코드 일치·인증 쿠키 공유·OAuth 성공·API 성공·스크롤/BFCache | 코드상 불명 또는 런타임 미확인 | 프런트 경로만으로 운영 런타임 성공을 판정할 수 없다. 특히 뒤로가기/BFCache와 로그인 후 replace 복귀를 혼동하면 안 된다. | 미확인 |

## 로그인 뒤 검증에 필요한 것

**필요한 것:** 이후 로그인 검증이 명시적으로 허용된 별도 작업에서 사용할 제공자 연동 테스트 계정(실제 개인 계정 사용·신규 생성 없이 사전 준비된 계정), 실행 가능한 독립 Chrome 환경, 전역 headless 잔류 확인 권한이 필요하다. 테스트 계정의 ATTRACTION/1이 미저장인지 사전 확인하고, 상세와 허브(검색어 `궁`·역사 필터·선택 ID 기록)를 각각 같은 탭에서 왕복한다. OAuth 시작 직전 apex sessionStorage의 `portal_login_next`와 콜백 후 삭제 여부, 최종 location.href, 허브 입력/활성 칩/선택 패널, 별 aria-pressed, Network의 wishlist keys GET·PUT/DELETE 시점을 관찰한다. 인증 코드·토큰·쿠키 값은 증거에 남기지 않는다. 복귀 직후 자동 PUT이 없는지, 다시 별을 눌렀을 때 대상 ID로 저장되는지를 구분한다. 이번 작업에서는 계정·제공자 로그인·apex 화면을 실행하지 않았다.
