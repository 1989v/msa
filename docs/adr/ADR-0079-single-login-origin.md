# ADR-0079 — 로그인은 apex 한 곳: 토큰을 도메인 쿠키로 옮겨 서브도메인이 세션을 공유한다

- 상태: 채택 (2026-08-22)
- 관련: ADR-0078(식별 최소화), ADR-0072(블로그 — 자체 로그인 화면을 두게 만든 제약),
  ADR-0066(포털 런처), ADR-0059(게임 서브도메인), ADR-0061(엣지 노출면)

## 맥락

게임 페이지에서 로그인을 누르면 이렇게 갔다.

```
https://game.1989v.com/shop/login?next=/games/sum-trail
        └ 서브도메인          └ shop 하위
```

두 가지가 동시에 잘못돼 있었다.

**① 로그인이 호스트마다 따로였다.** `getOAuthRedirectUri()` 가 `window.location.origin` 을 쓰니
콜백이 `game.1989v.com/oauth/callback` 이 된다. 제공자 콘솔에 호스트 수만큼 등록해야 하고,
하나라도 빠지면 그 화면에서 로그인이 통째로 막힌다 — 2026-08-22 게임 호스트에서
`redirect_uri_mismatch` 로 실제 발생했다.

**② 그리고 더 근본적으로, 토큰이 `localStorage` 였다.** `localStorage` 는 오리진마다 격리된다.
`1989v.com` 에서 로그인해도 `game.1989v.com` 은 그 토큰을 읽지 못한다. 즉 **서브도메인 수만큼
로그인해야 하는 구조**였고, ①을 고쳐 apex 로 모으기만 하면 오히려 로그인이 아예 성립하지
않는다(apex 에서 받은 토큰을 서브도메인이 못 본다).

이 제약의 흔적이 코드에 남아 있었다. `BlogLoginPage` 의 주석이 그 자체로 증언이다:

> apex 의 `/shop/login` 을 쓰지 않는 이유: 토큰은 localStorage 라 **오리진이 다르면 공유되지
> 않고**, OAuth 리다이렉트 URI 는 `window.location.origin` 기반이라 이 호스트가 제공자에
> 등록되어 있어야 한다

**③ 경로 이름이 실제와 어긋나 있었다.** `/shop/login` 인데 찜·게임 평점·블로그 댓글이 전부
이 화면을 거친다. `AuthButton` 주석에도 "로그인 진입점이 `/shop/login` 하나뿐이라 게임
페이지에서 평점을 남기려 해도 로그인할 방법이 없었다" 고 적혀 있었다. 이름이 거짓이면
다음 사람이 게임용 로그인을 또 만든다.

## 결정

### 1) 토큰을 `.1989v.com` 도메인 쿠키로 옮긴다

이것이 나머지를 가능하게 하는 전제다. 도메인 쿠키는 전 서브도메인이 공유하므로 한 번
로그인하면 어디서든 로그인 상태다.

**`httpOnly` 로 두지 않는다.** 그러면 JS 가 못 읽어 `Authorization: Bearer` 를 만들 수 없고,
게이트웨이를 쿠키 인증으로 바꿔야 하며 CSRF 방어가 새로 필요해진다. 전송은 지금처럼
헤더로 하므로 **쿠키 자동 전송에 기대지 않는다 — CSRF 표면이 생기지 않는다.**

XSS 관점에서 JS 가 읽는 쿠키는 `localStorage` 와 동일한 노출이다. **후퇴가 없고** 서브도메인
공유만 얻는다. `httpOnly` 로 한 단계 더 가는 것은 게이트웨이 인증 방식 변경이 선행돼야 하는
별도 결정이다.

`Secure` 는 https 에서만 붙인다 — 로컬 개발(http)이 조용히 로그인 불가가 되지 않게.
로컬·k3d 는 서브도메인이 없으므로 `Domain` 없이 host-only 쿠키로 떨어진다.

### 2) 로그인은 apex `/login` 한 곳

- 어느 호스트에서 눌러도 `https://1989v.com/login?next=<절대 URL>` 로 간다
- 서브도메인의 `/login` 은 apex 로 리다이렉트한다 — 거기서 그리면 콜백이 그 호스트로 잡힌다
- **제공자 콘솔에 등록할 `redirect_uri` 는 `https://1989v.com/oauth/callback` 하나**

`/shop/login` 은 없앤다. 남겨서 리다이렉트로 잇지 않는다 — 레거시 브리지를 두면 다음 사람이
어느 쪽이 정본인지 알 수 없다.

`BlogLoginPage` 도 지운다. 존재 이유가 위 제약이었고 그것이 사라졌다.

### 3) `next` 는 검증한다

apex 로 모으면서 `next` 가 **다른 호스트의 절대 URL** 이 됐다. 검증 없이 그대로 보내면
`?next=https://evil.example` 로 우리 로그인 화면을 미끼로 쓸 수 있다(오픈 리다이렉트).

`safeNext()` 가 https + `1989v.com`/`*.1989v.com` 만 통과시킨다. 상대 경로는 허용하되
`//evil.com` 같은 프로토콜 상대 주소는 막는다.

### 4) 복귀는 `location` 으로 한다

`next` 가 다른 호스트일 수 있어 react-router 의 `navigate()` 로는 도달할 수 없다.
콜백과 로그인 유도 지점은 `window.location` 을 쓴다. `AuthButton` 등이 `<Link>` 대신
`<a>` 인 이유도 같다 — 호스트를 넘는 이동은 라우터가 표현하지 못한다.

## 결과

**켜짐**

- 한 번 로그인하면 apex·game·place·blog·deal 전부 로그인 상태다.
- 제공자 콘솔 등록이 **URI 하나**로 줄었다. 서브도메인을 새로 붙여도 등록 작업이 없다.
- 로그인 화면이 하나다 — 서비스가 늘어도 또 만들 이유가 없다.
- 경로 이름이 실제와 맞는다.

**대가**

- 쿠키는 `*.1989v.com` 모든 요청에 실린다(토큰 2개 ≈ 1KB). 헤더 오버헤드가 늘지만
  단일 노드 규모에서 유의미하지 않다.
- 기존 `localStorage` 세션은 무효가 된다 — 재로그인이 필요하다. `logout()` 이 옛 키도
  함께 지워 잔재가 남지 않게 한다.
- 로그인 이동이 호스트를 넘으므로 SPA 전환이 아니라 전체 페이지 이동이다.

**되돌리기**

`auth.ts` 의 read/write 를 `localStorage` 로 되돌리면 되지만, 그 순간 서브도메인 세션 공유가
사라져 로그인 화면도 다시 갈라야 한다. 사실상 세트로 움직인다.

## 구현 위치

| 무엇 | 파일 |
|---|---|
| 쿠키 저장 · `safeNext` · `buildLoginHref` · 콜백 주소 | `portal-fe/src/auth/auth.ts` |
| 통합 로그인 화면 | `portal-fe/src/pages/LoginPage.tsx` |
| 라우트 · 서브도메인 리다이렉트 | `portal-fe/src/App.tsx` |
| 401 처리 | `portal-fe/src/shell/apiClient.ts`, `src/api/shopApi.ts` |
| 로그인 유도 지점 | `AuthButton` · `ShopHeader` · `FavoriteButton` · `FavoritesPage` · `GatedCodeSnippet` |

## 선행 조건 (운영)

Google Cloud Console 의 OAuth 클라이언트에 **`https://1989v.com/oauth/callback`** 이
등록돼 있어야 한다. 서브도메인 콜백은 더 이상 쓰지 않으므로 정리해도 된다.
