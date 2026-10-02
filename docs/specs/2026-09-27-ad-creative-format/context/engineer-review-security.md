# Engineer Review — Security

대상: `docs/specs/2026-09-27-ad-creative-format/spec.md`
근거: 스펙 · `planning/requirements.md` · `ads/CLAUDE.md` · `ads/feature` · `ads/domain` · `portal-fe/src/components/ads` · `portal-fe/src/pages/{ads,games}` · `admin/frontend/src`

## 체크리스트 판정

| # | 항목 | 판정 | 근거 |
|---|---|---|---|
| 1 | 위협 모델링 (STRIDE) | 부분 | 변조(형태·본문 필드 위조)와 DoS(압축 폭탄)는 기존 코드가 막는다. 형태 잠금 경합, 띠배너의 광고 표시는 아래 R-1·R-3 |
| 2 | 인증/인가 경계 | 통과 | 지면 변경은 어드민만 할 수 있다: `AdsAdminController.kt:126-164` 가 `RequestIdentity.admin` 을 부르고, 게이트웨이도 ROLE_ADMIN 을 확인한다(`AdsAdminController.kt:44`). 광고주 요청 모델에는 최저가가 없고, 모든 리소스를 (id, 광고주 id)로 찾는다(`CampaignService.kt:92-93`, `CreativeService.kt:101-105`). SR-1 의 형태 규격 추가·제거 API 도 같은 컨트롤러 패턴을 따르면 된다 |
| 3 | 민감 데이터 흐름 | 해당 없음 | 새 PII 없음. 대체 텍스트는 광고주가 공개로 쓰는 문자열 |
| 4 | 입력 검증 바운더리 | 부분 | 서버 이미지 검사 순서(SR-3)는 코드와 같다. 헤더 픽셀이 300KB 검사보다 먼저 오고 디코딩은 그 뒤다(`CreativeImageRules.kt:30-40`, `CreativeImageService.kt:23-29`). XSS: 광고 FE 에 `dangerouslySetInnerHTML` 이 없고(`admin/frontend` 에서 유일한 사용처는 `BlogPostsPage.tsx:198` 로 광고와 무관), 광고주 문자열은 텍스트 노드로 그린다(`AdCard.tsx:8,31-34`, `CreativesPanel.tsx:117-119`). JSX `alt={...}` 는 속성으로 이스케이프되므로 SR-5 의 `alt`=대체 텍스트는 안전하다. `parseAd` 는 링크·이미지 접두 검사를 한다(`adsApi.ts:138-139`). 모르는 형태를 버리는 것(SR-5)도 닫힌 쪽으로 실패한다. 브라우저 사전 검사와 수정 경로의 형태 규칙은 R-2·R-3 |
| 5 | 서비스 간 통신 | 해당 없음 | 새 호출 없음 |
| 6 | 시크릿 | 해당 없음 | — |
| 7 | 암호화 | 해당 없음 | — |
| 8 | 감사 로깅 | 통과 | SR-1 은 변경마다 감사 기록을 남기고 요약에 형태별 최저가를 넣는다 |
| C1 | PCI | 해당 없음 | 가상 크레딧 |
| C2 | 변경 권한 | 통과 | #2 와 같음 |
| C3 | Rate limiting / 남용 | 통과(기존) | 업로드는 서버가 최종 판정한다(SR-6 "최종 판정은 서버"). multipart 상한은 Boot 기본값(파일 1MB)이고 `engagement` 에 따로 설정하지 않았다. 이번 범위 밖 |

## 이슈 (REVISE)

### R-1 띠배너 광고 표시·링크 속성을 게임 목록 경로까지 못 박는다 (체크 #1, 광고 표시)
- 스펙: SR-5 는 `AdSlot` 의 띠배너에 「광고」 표시를 요구하고, `HouseBanner` 에 대해서는 "유료 BANNER 우승자가 있으면 그것을"이라고만 적었다.
- 코드: `HouseBanner` 의 감싸는 요소가 `aria-label="홍보"`(`portal-fe/src/pages/games/HouseBanner.tsx:27`)다. 여기에 유료 광고를 넣으면 스크린리더는 유료 광고를 "홍보"로 읽는다. 유료 카드의 링크 속성 `target="_blank" rel="sponsored nofollow noopener"` 와 리다이렉터 경유(`AdCard.tsx:20-22`)도 띠배너 요구사항에 적혀 있지 않다.
- 수정안: SR-5 에 다음 두 문장을 더한다.
  - 띠배너 컴포넌트는 `AdCard` 와 같은 링크 속성을 쓴다: `clickHref`, `rel="sponsored nofollow noopener"`, 새 탭.
  - 유료 띠배너를 그리는 모든 자리(`AdSlot`·`HouseBanner`)는 `aria-label="광고"` 이고, 「광고」 표시는 이미지 위가 아니라 이미지 밖에 둔다. 광고주 이미지가 표시를 가리거나 흉내 내지 못하게 하기 위해서다. HOUSE 일 때만 "홍보"를 쓴다.

### R-2 브라우저 사전 검사도 디코딩 전에 거른다 (체크 #4, 압축 폭탄)
- 스펙: SR-6 은 브라우저에서 "형식·용량·픽셀·비율"을 검사하라고만 적었고, 픽셀을 어떻게 얻는지는 정하지 않았다.
- 코드: 서버는 픽셀 데이터를 풀지 않고 헤더에서 가로·세로를 읽는다(`CreativeImageRules.kt:19-20,42-77`). 브라우저에서 `Image`/`createImageBitmap` 으로 픽셀을 얻으면 300KB 안의 20000×20000 PNG 를 통째로 풀어 광고주 탭이 멈춘다. 현재 콘솔은 `file.type` 과 크기만 본다(`CreativesPanel.tsx:76-83`).
- 수정안: SR-6 에 "형식(앞 바이트)·용량을 먼저 보고, 실패하면 거기서 멈춘다. 가로·세로는 파일 앞부분 헤더에서 읽고, 미리보기 디코딩은 모든 검사를 통과한 뒤에만 한다"를 더한다. 형식은 `file.type` 이 아니라 앞 바이트로 판정해야 서버 판정과 어긋나지 않는다. 서버가 여전히 권위라는 문장은 유지한다.

### R-3 형태 불변과 형태별 내용 규칙을 서버의 모든 쓰기 경로에서 지킨다 (체크 #1 변조, #4)
- 스펙: SR-2 는 "소재가 하나라도 있으면 바꿀 수 없다"고, SR-3 은 "소재 형태는 캠페인에서 온다 · BANNER 는 설명이 비어 있어야 한다"고 정했다.
- 코드:
  - 캠페인 수정은 행 잠금이나 `@Version` 없이 읽고 저장한다(`CampaignService.kt:62-80`). `@Version` 은 원장 계정에만 있다(`LedgerAccountJpaEntity.kt:37`). 소재 등록도 캠페인을 잠그지 않고 읽는다(`CreativeService.kt:54-62`). 그래서 "소재 수 0 확인 → 형태 변경"과 "옛 형태로 소재 저장"이 동시에 커밋될 수 있다.
  - 소재 수정은 이미지를 바꾸지 않으면 캠페인을 읽지 않는다(`CreativeService.kt:73-77`). 그 경로에서 캠페인 형태를 보지 않으면 API 를 직접 불러 BANNER 소재에 설명을 넣을 수 있다.
- 영향: 후보 인덱스의 비율 사전 필터(SR-4) 덕에 비율이 틀린 소재는 게재되지 않는다. 그래서 과금 사고보다는 데이터 불일치와 심사 화면 오표시로 나타난다.
- 수정안:
  - SR-2 에 "형태 잠금은 서버가 판정한다. 형태 변경과 소재 등록은 캠페인 행을 `FOR UPDATE` 로 잡는다(또는 캠페인에 버전 컬럼)"를 적는다.
  - SR-3 에 "형태별 내용 규칙은 소재 등록·수정 **둘 다** 캠페인 형태로 검사한다(이미지 없는 수정 포함)"를 적는다.
  - 회귀 주입 대상에 "BANNER 캠페인 소재를 body 를 채워 수정하면 거절된다"를 넣는다.

## 참고 (조치 불요)
- 어드민이 최저가를 올리거나 형태 규격을 지워도 후보 인덱스 사전 필터(SR-4)와 시작·재개 재검사(`CampaignRules.kt:32-41`)가 막는다. 권한 문제는 아니다.
- 심사 화면(SR-7)은 대체 텍스트를 보여 주므로, 오해를 부르는 대체 텍스트("닫기" 등)는 심사가 거른다.

VERDICT: REVISE

## Round 2

대상: `spec.md` 개정 2. 1차 판정 병합(`context/review-verdict.md:13,17,18`)에서 R-1·R-2·R-3 을 모두 유지(keep)했다.

### 1차 이슈 해소 여부

| 1차 | 판정 | 근거 |
|---|---|---|
| R-1 띠배너 광고 표시·링크 | 해소 | `spec.md:50`: 띠배너는 이미지 **밖**에 「광고 · 광고주 이름」을 두고, 링크는 `AdCard` 와 같다(`clickHref`·`rel="sponsored nofollow noopener"`·새 탭). `spec.md:51`: `HouseBanner` 는 유료면 `aria-label` 「광고」, HOUSE 면 「홍보」. 테스트 계획 `planning/test-quality.md:23-24`(C2·C3)가 이 속성들을 검사 대상으로 잡았다 |
| R-2 브라우저 사전 검사 | 해소 | `spec.md:59`: 앞 바이트로 형식을 판정한다(MIME 무시, 빈 MIME 도 판정). 순서는 용량 → **헤더에서 읽은** 가로·세로(PNG IHDR·JPEG SOF, 픽셀을 풀지 않음) → 비율이다. 미리보기 디코딩은 모두 통과한 뒤에만 하고, 최종 판정은 서버가 한다. `spec.md:83` 은 FE 헤더 파서가 서버 `CreativeImageRules` 와 같은 규칙을 쓰도록 했다 |
| R-3 형태 불변·내용 규칙 | 해소 | 경합: `spec.md:29` 에서 형태를 **만들 때 정하고 바꿀 수 없게** 했고, 수정 요청에는 형태 필드가 없다. 형태 변경 경로가 없으니 「소재 수 0 확인 → 형태 변경」과 소재 등록이 겹치는 경합도 설계에서 사라졌다. 따라서 `FOR UPDATE` 는 필요 없다. 수정 경로: `spec.md:36` 에 따라 등록·수정 **모두**(이미지 없이 문구만 고치는 수정 포함) 캠페인 형태로 검사한다. 회귀 대상은 `planning/test-quality.md:16`(I3)에 있다: 「문구만 수정도 형태 검사 · 수정 요청의 형태 필드 무시」 |

### 개정 2에서 새로 생긴 표면

| 항목 | 판정 | 근거 |
|---|---|---|
| HOUSE 형태 규격 면제(`spec.md:31`) | 통과 | HOUSE 캠페인은 광고주 API 로 만들 수 없고(`ManageHouseCampaignUseCase.kt:7`), 운영자 경로에서만 만든다. 이 경로는 감사 기록을 남긴다(`HouseCampaignService.kt:49,61`, `HouseCreativeService.kt:46`). 따라서 이 면제로 권한이 올라가는 경로는 없다 |
| 카탈로그의 업로드 규칙 공개(`spec.md:32,61`) | 통과 | 파일 형식·최대 바이트·픽셀·오차는 원래 공개된 제한이라 노출돼도 위험이 없다. 서버가 여전히 권위다 |
| 옛 컬럼 이중 쓰기·롤백(`spec.md:69-71`) | 통과 | 권한이나 입력 경계에는 변화가 없다. 롤백하기 전에 BANNER 소재를 ARCHIVED 로 돌려 두므로, 롤백 뒤 옛 코드가 형태를 모르는 소재를 게재하는 일도 없다 |
| ①·② 사이 옛 번들(`spec.md:70`) | 통과 | 옛 번들은 BANNER 를 카드 틀로 그릴 수 있지만, 카드 틀에도 「광고」 표시와 `rel="sponsored"` 가 붙어 있다(`AdCard.tsx:20-22`). 광고 표시가 빠지는 경우는 없다 |

남은 이슈 0, 새 이슈 0.

VERDICT: SHIP
