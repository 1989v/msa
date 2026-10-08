# Security Review — `/tech/search` 검색 아키텍처 페이지

## 2라운드 (2026-10-08)

대상은 개정 `spec.md` 다. 심판 결정(`context/review-verdict-round1.md`)은 다시 다루지 않는다. 1라운드 4건은 모두 해소됐다. 새 발견은 1건이고 비차단이다.

### 1라운드 해소 여부

| 1R 이슈 | 판정 | 근거 |
|---|---|---|
| 1. 빌드 경로 배선 | **해소** | SR-2.4 가 렌더 단계를 세 곳에 같은 순서로 넣는다. 세 곳은 `package.json` build·dev, `portal-fe/Dockerfile:41`, ci.yml Type check 앞(`.github/workflows/ci.yml:287`)이다. `ARG GIT_SHA` 를 :41 앞으로 올리는 것도 적혀 있다. 지금은 `Dockerfile:54` 에 있다. 렌더 테스트는 `src/content/__tests__/` 로 옮겨졌다(SR-6.1). 그래서 `vitest.config.ts:13` include `src/**` 안에 든다. 배선 증명은 SR-6.3 ⑩ 이 맡는다. 생성 JSON 을 지운 채 `tsc -b` 를 돌리면 TS2307 이 난다. 생성물은 gitignore 이고 이미지 빌드는 깨끗한 체크아웃을 컨텍스트로 쓴다(`Dockerfile:13` `COPY . .`). 따라서 렌더 단계가 빠지면 이미지 빌드가 깨진다. ⑪ 이 docker build 전체를 돌리지 않는 것은 이 점 때문에 수용한다. |
| 2. 트립와이어 벡터 | **해소** | SR-2.3 ③ 이 1R 에서 지적한 태그 7종과 `srcdoc=` 을 추가했다. ⑤ 는 href·src·xlink:href 를 허용 목록으로 검사하고, ⑥ 은 주석 잔존을 본다. SR-2.2 는 출력에서 주석을 걷어낸다. 「sanitizer 가 아니라 출력 계약 트립와이어」라는 명시도 SR-2.3 과 SR-3.3 에 들어갔다. SR-6.1 에는 `javascript:`·`<base href>` throw 테스트가 들어갔다. 금칙 패턴 오탐은 없다. fencesvg 는 좌표를 소수 둘째 자리로 반올림한다(`node_modules/fencesvg/dist/index.js:2` `Math.round(t*100)/100`). 그래서 IPv4 패턴에 걸릴 좌표 문자열이 안 생긴다. 모델 ref `…270m@31de22b#d640`(`k8s/base/search/deployment.yaml:34`)은 `@` 뒤에 점이 없어 메일 패턴에 안 걸린다. |
| 3. SR-1.7 판단 기준·게이트 | **해소** | SR-1.7 이 「ADR·README·매니페스트에 이미 있으면 적고 없으면 적지 않는다」를 판단 기준으로 둔다. 그 게이트는 SR-2.3 ⑦ 의 금칙 패턴이다. ⑦ 에는 `myrealtrip` 도 추가됐다. |
| 4. SR-4.4 `<script` 단언 | **해소** | SR-4.4 는 이제 `<div id="root">` 안쪽 본문에만 `<script`·`<style` 부재를 단언한다. 셸과 JSON-LD 는 제외한다. 이 형태는 `prerender-seo.mjs` 의 `compose` 출력과 모순되지 않는다. |

### 새 발견

#### N1. [체크 4·입력 검증] 트립와이어 ④ 이벤트 속성 정규식을 `/` 구분자로 우회할 수 있고, ④ 를 증명하는 테스트가 없다 — REVISE(비차단)

- **스펙이 정한 것.** SR-2.3 ④ 는 `/<[^>]*\son[a-z]+\s*=/i` 이다. 이 정규식은 속성 이름 앞에 공백이 있어야 걸린다.
- **marked 가 통과시키는 것.** marked 블록 HTML 규칙은 `</?(tag)(?: +|\n|/?>)[\s\S]*?(?:\n[ \t]*)+\n` 이다(`portal-fe/node_modules/marked/lib/marked.esm.js:13`, `Me=k(…)`). 블록 태그로 시작한 블록은 빈 줄이 나올 때까지 원문 그대로 나간다. 아래 md 는 그대로 출력된다.

  ```html
  <div>
  <svg/onload=alert(1)>
  </div>
  ```

  브라우저 HTML 파서는 `/` 를 속성 구분자로 읽으므로 `onload` 가 실행된다.
- **나머지 조건도 안 잡는다.** ③ 은 `<svg` 를 막지 않는다. 다이어그램이 SVG 이기 때문이다. ⑤ 는 href·src 가 없으니 해당되지 않는다. ② 는 `svg[role="img"]` 만 세므로 role 없는 SVG 는 수에 안 든다. 결국 ④ 가 유일한 방어선인데 그 ④ 에 구멍이 있다. 같은 모양으로 `<img src="/x"/onerror=…>` 도 블록 안에서 지나간다.
- **증명도 없다.** SR-6.1 이 throw 를 확인하는 입력은 `javascript:`, `<base href>`, 금칙 패턴뿐이다. ④ 를 빨간불로 만드는 입력은 SR-6.1 에도 SR-6.3 에도 없다. 루트 `CLAUDE.md` 의 「회귀를 주입해 빨간불을 본 뒤에만 켰다고 말한다」에 걸린다.
- **위험도.** 원본은 커밋된 md 뿐이다. 1R 위협 모델은 「저자 경유 XSS 는 새 권한이 아니다」로 정리했다. 그래서 이것은 차단 사유가 아니다. 다만 ④ 가 가장 흔한 XSS 형태를 맡는 유일한 조건이다. 의존성 판올림이나 붙여넣은 HTML 조각이 이 모양을 내면 조용히 통과한다.
- **수정안.** 두 가지를 스펙 문구로 넣으면 된다. 구현 태스크에서 바로 흡수할 수 있어 3라운드는 필요 없다.
  1. ④ 를 `/<[^>]*[\s\/"']on[a-z]+\s*=/i` 로 바꾼다. 속성 앞에 공백·`/`·따옴표 중 하나가 있으면 잡는다.
  2. SR-6.1 renderContent 테스트에 throw 입력 두 건을 더한다. 하나는 `<div>\n<img src="/x" onerror="x">\n</div>`, 다른 하나는 `<div>\n<svg/onload=x>\n</div>` 이다.

### 이슈 아님 (기록)

- **프로토콜 상대 주소.** ⑤ 의 `/` 허용은 `//host/…` 도 통과시킨다. 하지만 https 페이지에서 이 주소는 https 로 풀리고 스크립트를 실행하지 않는다. 외부 링크 정책 문제이지 보안 결함은 아니다.
- **프리렌더 실패 경로.** `Dockerfile:40` 주석은 「프리렌더 실패해도 빌드는 통과」라고 적혀 있다. 그러나 `PartialSeoFailure` 는 exit 1 로 빌드를 세운다(`portal-fe/scripts/prerender-seo.mjs:150-152`). 생성 JSON 이 없을 때 SR-4.2 가 이 예외를 쓰므로 실패가 조용히 묻히지 않는다.
- **⑥ 주석 잔존 검사.** SR-2.2 가 주석을 먼저 걷어내므로 ⑥ 은 대개 초록이다. 이 검사는 제거기 자체의 회귀를 잡는 용도로 의미가 있다. 예를 들어 중첩되거나 깨진 주석이 남는 경우다.

---

## 1라운드

2026-10-08. 체크리스트 `hns/0.16.1/skills/spec-review/reviewers/security/checklist.md`. 경로는 작업 트리 루트 기준.

### 위협 모델 (STRIDE 요약)

| 축 | 판정 | 근거 |
|---|---|---|
| Spoofing / 인증·인가 | 해당 없음 | 공개 정적 페이지. 문서가 말하는 `/api/search/**` 공개는 코드와 일치 (`gateway/src/main/kotlin/com/kgd/gateway/config/GatewayRouteConfig.kt:369-373`). `gateway/README.md:25` 「JWT 필요」는 코드보다 보수적인 오기라 위험 없음(Q5 보고만) |
| Tampering | **REVISE** | 산출물 HTML 을 만드는 경로(이미지 빌드·CI)에 SR-2.3 계약 검사가 배선되지 않는다 — 이슈 1 |
| Repudiation / 감사 | 해당 없음 | 쓰기 경로 없음 |
| Information Disclosure | **REVISE** | SR-1.7 이 문장 규칙뿐 — 이슈 3 |
| DoS | 해당 없음 | SVG 5장 인라인 정적 HTML. nginx `no-cache`(`portal-fe/nginx.conf:155`) 위에 Cloudflare 엣지 |
| EoP | 해당 없음 | 런타임 권한 경계 없음 |
| 입력 검증 (XSS) | **REVISE** | 원본은 레포 커미터(이미 TSX 를 쓸 수 있는 사람)라 저자 경유 XSS 는 새 권한이 아니다. 남는 위협은 **의존성 판올림이 출력 계약을 바꾸는 것**이고 SR-2.3 블록리스트에 구멍이 있다 — 이슈 2 |
| 서비스 간 통신 / 시크릿 / 암호화 / Rate limit / PCI | 해당 없음 | 빌드타임만. 드리프트 테스트가 읽는 `k8s/base/search/deployment.yaml:33-37` 은 모델 ref·플래그뿐 |

### 이슈

#### 1. [체크 4·Tampering] SR-2.3 계약 검사가 **배포 산출물을 만드는 경로에서 돌지 않는다** — REVISE

SR-3.3 의 「런타임 sanitize 없음」은 「SR-2.3 이 빌드마다 돈다」에 기대고 있는데, 스펙이 고치는 곳은 `package.json` build 한 줄(SR-2.4)뿐이다.

- `portal-fe/Dockerfile:41` 은 `npm run build` 를 부르지 않고 `npx tsc -b --force && npx vite build --base / && node scripts/prerender-seo.mjs` 를 직접 돈다 → 이미지 빌드에 `render-content.mjs` 단계가 없다. 생성 JSON 이 `.gitignore`(Q1)라 `tsc -b` 가 import 를 못 풀어 빌드가 요란하게 깨지는 쪽이 그나마 다행이고, 누가 JSON 을 커밋해 넘기면 **계약 검사를 거치지 않은 HTML 이 배포된다**.
- `.github/workflows/ci.yml:287-295` 도 `tsc -b` → `vitest run` 순서에 렌더 단계가 없다 → 페이지·프리렌더 테스트(SR-6.1)가 JSON import 에서 먼저 깨진다.
- `portal-fe/vitest.config.ts:13` include 는 `src/**`·`tests/**` 뿐이고 `portal-fe/tsconfig.app.json:30` include 도 `["src"]` 다 → SR-6.1 의 `scripts/__tests__/renderContent.test.ts` 는 **CI 에서 한 번도 돌지 않는 무동작 게이트**가 된다(`<script>` → throw 검사가 여기 있다).

**수정안**: SR-2.4 에 세 줄 추가 — ① `Dockerfile:41` 의 `tsc -b` 앞에 `node scripts/render-content.mjs &&` ② `ci.yml` Type check 스텝 앞에 같은 한 줄 ③ 렌더 단위 테스트는 `src/content/__tests__/renderContent.test.ts` 로 두고 `scripts/render-content.mjs` 를 상대 import(선례 `src/seo/__tests__/prerenderPlace.test.ts:15` 가 `../../../scripts/prerender-seo.mjs` 를 import). SR-6.3 회귀 주입에 「Dockerfile 경로로 `docker build` 1회 → 펜스 깨뜨리면 이미지 빌드 실패」를 넣어 배선을 증명한다.

#### 2. [체크 4·입력 검증] SR-2.3 블록리스트에 빠진 벡터 — REVISE

- `portal-fe/node_modules/marked/lib/marked.esm.js:76` — `<a href="'+e+'"` 로 href 를 **그대로** 낸다(marked 18 에 sanitize 옵션 없음). `[x](javascript:…)`·`data:text/html,…`·`vbscript:` 가 통과한다. 블로그는 `portal-fe/src/pages/blog/markdown.ts:27-30` 의 DOMPurify 가 막지만 이 경로엔 없다.
- 마크다운 raw HTML 통과분: `<object`·`<embed`·`<base`(프리렌더 문서 전체의 상대 URL 을 바꾼다)·`<meta http-equiv`(refresh 리다이렉트)·`<link`·`<form`·`srcdoc=` — SR-2.3 정규식이 보지 않는다.
- fencesvg 0.11.2(`node_modules/fencesvg/package.json:3`) dist 에는 `<a`·`href=`·`xlink:href` 출력이 **0건**이라 지금은 SVG 앵커 벡터가 없다. mermaid `click` 지시어가 추가되면 바뀐다.
- `<!-- source: … -->`(SR-1.1) 는 marked 를 통과해 JSON·JS 번들에 남는다. `scripts/strip-html-comments.mjs:28` 은 dist HTML 만 지운다. 경로는 공개 레포(ADR-0055:37)라 비밀은 아니지만, 번들에 내부 설계 주석을 싣지 않는다는 그 스크립트의 의도(`:4-6`)와 어긋난다.

**수정안**(정규식, 파서 추가 없음): SR-2.3 실패 조건에 ① `<object`·`<embed`·`<base`·`<meta`·`<link`·`<form`·`srcdoc=`·`<svg[^>]*>[\s\S]*?<a\b` ② 모든 `href=`·`src=`·`xlink:href=` 값이 `#`·`/`·`https://` 로 시작하는지 **허용 검사**(블록리스트가 아니라 허용 목록이라 스킴 변종을 통째로 막는다) ③ 출력에서 HTML 주석 제거. SR-6.1 renderContent 테스트에 `[x](javascript:alert(1))` → throw, `<base href>` → throw 두 건 추가. 공급망의 **악의적** 경우(빌드 시 코드 실행)는 어떤 출력 검사로도 못 막으므로, SR-2.3 은 「보안 경계」가 아니라 「출력 계약 드리프트 검출기」라고 SR-3.3 에 한 줄 적어 두면 다음 사람이 과신하지 않는다.

#### 3. [체크 3·Information Disclosure] SR-1.7 공개 경계는 맞지만 게이트가 없다 — REVISE

- 경계 판단은 맞다: 레포는 공개(`docs/adr/ADR-0055-opensearch-migration.md:37`, `docs/specs/2026-09-24-concept-atlas/spec.md:55` 의 `raw.githubusercontent.com/1989v/msa`). 내부 DNS 는 `portal-fe/nginx.conf:81,195` 에, 모델 ref 는 `k8s/base/search/deployment.yaml:33-34` 에, 지연 실측은 `docs/conventions/latency-budget.md` 에 이미 있다. 판정 세트는 수(150·6,530)만 적고 쿼리 원문은 안 적는다(SR-1.5).
- 그러나 SR-1.7 은 문장 규칙이라 다음 갱신자가 OCIR 경로·운영 Redis 키 실제 값·CronJob 자격·파드 IP 를 표에 붙여도 아무것도 안 울린다. 루트 `CLAUDE.md` 의 「grep 으로 참/거짓이 나오는 규칙은 게이트로」에 걸린다.

**수정안**: SR-2.3 실패 조건에 거부 패턴 한 묶음 — `svc\.cluster\.local`, `\.ocir\.io`, `\b\d{1,3}(\.\d{1,3}){3}\b`(IP), `[\w.-]+@[\w.-]+\.\w+`(메일), `(api[_-]?key|secret|password|token)\s*[:=]`. 그리고 SR-1.7 에 판단 기준 한 줄: 「값이 ADR·README·매니페스트에 이미 있으면 적고, 없으면 적지 않는다 — 판정 세트 쿼리 원문·Redis 실제 키·레지스트리 경로·자격은 어느 문서에도 없으므로 뺀다」.

#### 4. [체크 4·테스트 가드] SR-4.4 「`<script` 없음」은 SR-4.2 와 모순이라 단언이 약화될 것이다 — REVISE

- SR-4.2 가 JSON-LD `TechArticle` 을 요구하고, `portal-fe/scripts/prerender-seo.mjs:418` 은 그것을 `<script type="application/ld+json">` 로 낸다. 셸 `portal-fe/index.html:15,62,140` 에도 `<script>` 3개가 있다. `compose`(`:424-432`)가 셸에 본문을 끼우므로 **출력 문서엔 항상 `<script` 가 있다** → SR-4.4 는 쓰자마자 빨강이고, 구현자가 단언을 지우면 스크립트 주입 검사가 사라진다.

**수정안**: `<div id="root">` 안쪽 본문만 떼어 `<script`·`<style` 부재를 단언하거나, `<script` 매치가 전부 `application/ld+json` 또는 셸 원본의 것인지(셸 `<script` 수 + JSON-LD 수 == 총 수) 대조. 선례 `prerenderPlace.test.ts:148-150` 은 ld+json 만 센다.

### 이슈 아님 (기록)

- **CSP 충돌 없음**: 사이트 전역 CSP 가 없다 — `portal-fe/nginx.conf:268` 의 `frame-ancestors` 는 게임 프레임 location 한정, `index.html` 에 `http-equiv` 없음, k8s ingress 에 CSP 없음(`k8s/overlays/oci-arm/ingresses/private-games.yaml:32-33` 은 X-Robots-Tag 뿐), ADR-0061 에 CSP 언급 없음. fencesvg 는 인라인 `style` 속성을 낸다(`node_modules/fencesvg/dist/index.js:3` `style="overflow-x:auto"`·`style="min-width:…"`, `:10` `<summary style="cursor:pointer">`) — 프리렌더 `shellBody`(`prerender-seo.mjs:465`)도 같은 모양이라 **CSP 를 들일 때 `style-src` 에 인라인 속성 허용이 함께 필요**하다는 것만 SR-3 에 한 줄 남기면 된다.
- **드리프트 테스트의 `../` 읽기**: 경로는 상수라 탈출 입력이 없다. `ci.yml:240-244` 체크아웃이 루트 전체(서브모듈 제외, `search/`·`k8s/` 는 본체)이고 `:294` `working-directory: portal-fe` 라 읽힌다. 읽기 전용이라 워크플로 권한 추가 불필요.
- **지식베이스**: `[[markdown-diagram-publishing-path]]`(1989v 볼트, 2026-09-09) 가 「sanitize 에서 `<style>`·`<use>` 가 죽는다」·「빈 줄이 블록을 끊는다」를 실측으로 갖고 있고 SR-2.3 과 일치한다. 충돌 없음.

1라운드 판정: REVISE

VERDICT: REVISE
