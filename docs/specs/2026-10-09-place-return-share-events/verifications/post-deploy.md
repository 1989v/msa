# 배포 뒤 확인 — 묶음 공유 · GA 로더 (SR-4.4)

- 배포: 커밋 `0d7377f93`, 이미지 `0d7377f`(gateway·account·portal-fe), 2026-10-09 12:31 KST 롤아웃. 설정 `kgd.wishlist.share.enabled` 는 기본 false(켜지 않음)
- 방법: curl 만(브라우저 없음), GET 만
- 측정 대상 최신 여부: apex `https://1989v.com/` 의 번들 `/assets/index-Cm9QxGrC.js`(place 와 같은 해시), index.html 에 이번에 넣은 `%2Fshared%2F` 문자열 1건 → 유효
- 측정 시각: 2026-10-09 12:43:47 KST

## 판정 요약

| 항목 | 결과 | 판정 |
|---|---|---|
| 꺼짐: `GET /api/v1/wishlist/shared/abcdefghij` | 404 `application/json` | 통과 |
| 꺼짐: `GET /c/abcdefghij` | 404 `application/json`(302 아님) | 통과 |
| 두 응답 본문 동일 | 7개 응답 본문 md5 모두 `d8b32bc1d64736423fddb32ebfea15bb` | 통과 |
| 신원 헤더 위조(`X-User-Id`·`X-User-Roles`·`Authorization`) | 상태·본문 동일(404) | 통과 |
| 형식 밖 토큰(`/shared/x`·`/c/x`) | 같은 404·같은 본문(405 아님) | 통과 |
| GA 로더 조건 셋 | `/shared/` 경로 · `%2Fshared%2F`(i) · referrer 경로 `/shared/` 세 조건이 resume 제외 바로 다음 줄에 있음 | 통과 |
| GA 요청 0건(CDP, 세 경우 + 대조군) | ①②③ 각 0건, 대조군 `https://1989v.com/` 1건(+ collect 1건) — 아래 「브라우저 확인」 | 통과 |

본문이 게이트웨이 기본 404(타임스탬프 포함 JSON)가 아니라 `ApiResponse` 형식(`{"success":false,…,"code":"NOT_FOUND"}`)이다 — 라우트가 account 까지 닿아 UseCase 의 꺼짐 분기가 낸 404 로 읽힌다.

## 명령과 결과 줄

```bash
run(){ curl -s -m 20 -o f/b$i -D f/h$i "$@"; ... }   # 상태·content-type·Location·본문 앞 160자
run https://1989v.com/api/v1/wishlist/shared/abcdefghij
run -H 'X-User-Id: 1' -H 'X-User-Roles: ROLE_ADMIN' https://1989v.com/api/v1/wishlist/shared/abcdefghij
run -H 'Authorization: Bearer forged' https://1989v.com/api/v1/wishlist/shared/abcdefghij
run https://1989v.com/c/abcdefghij
run -H 'X-User-Id: 1' -H 'X-User-Roles: ROLE_ADMIN' https://1989v.com/c/abcdefghij
run https://1989v.com/api/v1/wishlist/shared/x
run https://1989v.com/c/x
md5 -q f/b1 … f/b7 | sort | uniq -c
```

```text
2026-10-09 12:43:47 KST
1  404 https://1989v.com/api/v1/wishlist/shared/abcdefghij ctype=application/json loc= body={"success":false,"data":null,"error":{"code":"NOT_FOUND","message":"리소스를 찾을 수 없습니다"}}
2  404 (X-User-Id·X-User-Roles 위조)        같은 본문
3  404 (Authorization: Bearer forged)       같은 본문
4  404 https://1989v.com/c/abcdefghij ctype=application/json loc= body={"success":false,"data":null,"error":{"code":"NOT_FOUND","message":"리소스를 찾을 수 없습니다"}}
5  404 (/c + X-User-Id·X-User-Roles 위조)   같은 본문
6  404 https://1989v.com/api/v1/wishlist/shared/x   같은 본문
7  404 https://1989v.com/c/x                        같은 본문
   7 d8b32bc1d64736423fddb32ebfea15bb
```

```bash
curl -s https://1989v.com/ -o apex-index.html
grep -n -E "googletagmanager|/shared/|%2Fshared%2F|referrer|resume" apex-index.html
```

```text
14:        if (host.split(".")[0] === "resume") return;
15:        if (/^\/shared\//.test(location.pathname) || /%2Fshared%2F/i.test(location.search) || /^[a-z][a-z0-9+.-]*:\/\/[^\/?#]+\/shared\//i.test(document.referrer)) return;
19:        tag.src = "https://www.googletagmanager.com/gtag/js?id=" + id;
```

## 브라우저 확인 — GA 요청 0건 (CDP)

- 측정 시각: 2026-10-09 13:17 KST
- 대상 최신 여부: 측정한 모든 화면의 번들이 `index-CHqeEIQl.js` 다. portal-fe `9f65c3a` 빌드이고 place 와 같은 해시다 → 유효
- 방법:
  - 독립 프로필 헤드리스 크롬 + Node 22 WebSocket CDP(`scratchpad/meas3/f.mjs`)
  - 사람 UA(macOS Chrome), 1280×800, 캐시 끔, 경우마다 새 탭, 로드 뒤 8초 대기
  - `Network.requestWillBeSent` 에서 `googletagmanager.com`·`google-analytics.com` 요청을 셌다
  - 시작·측정·종료는 한 명령이고, 끝난 뒤 남은 크롬은 0이다

| 경우 | googletagmanager.com | google-analytics.com | `window.gtag` · `dataLayer` | 판정 |
|---|---|---|---|---|
| ① `https://1989v.com/shared/abcdefghij` 직접 | **0** | 0 | undefined · 없음 | 통과 |
| ② `https://1989v.com/login?next=https%3A%2F%2F1989v.com%2Fshared%2Fabcdefghij` 직접 | **0** | 0 | undefined · 없음 | 통과 |
| ③ `/shared/abcdefghij` 에서 별 → `/login` | **0**(두 문서 합) | 0 | undefined · 없음 | 통과 |
| 대조군 `https://1989v.com/` | **1** (`gtag/js?id=G-5EE8XW7JHN`) | 1 (`g/collect`) | function · 있음 | 통과(로더가 살아 있음) |

- ①: 화면은 「찾을 수 없거나 만료된 링크입니다…」다(설정 꺼짐 → 404).
- ③ 은 운영 설정 `kgd.wishlist.share.enabled` 가 꺼져 있어 실제 응답이 404 다. 404 면 카드도 별도 그려지지 않는다.
  - 그래서 브라우저 쪽에서 `Fetch.requestPaused` 로 `GET /api/v1/wishlist/shared/abcdefghij` 한 건만 200 으로 대신 채웠다(묶음 1개, 관광지 `77`, 대체 1건). 서버에는 아무것도 쓰지 않았다.
  - 관광지 카드 조회는 운영 API 그대로다. 카드 1장과 별(`aria-label` 「관광지 찜」)이 그려졌다.
  - 게스트로 별을 누르자 문서가 `https://1989v.com/login?next=https%3A%2F%2F1989v.com%2Fshared%2Fabcdefghij` 로 이동했다. 로그인 화면의 `document.referrer` 는 `https://1989v.com/shared/abcdefghij` 다. 즉 로더 조건 셋 중 쿼리(`%2Fshared%2F`)와 referrer 둘이 함께 걸린 상태다.
  - 클릭 전·후 모두 GA 요청 0건이다.
- 대조군이 1건 이상이라 「0건」이 로더 고장이 아니라 조건에 걸린 결과임을 보인다.
