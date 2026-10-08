# Engineer Review — test-strategy (1라운드)

대상: `docs/specs/2026-10-08-place-trust-pages-etag/spec.md` (origin/main a05ab2765 기준 작업 트리)
기준: hns test-strategy 체크리스트, `docs/standards/test-rules.md`, 전역 CLAUDE.md 「검사는 대상의 산출물을 본다」·「회귀 주입」·「재기 전에 대상이 최신인지」.
세션 결정 ①~⑥ 은 재론하지 않는다. 아래는 전부 「그 결정을 테스트가 실제로 지키게 하는 방법」에 관한 것이다.

## 판정 요약

| # | 체크 항목 | 판정 |
|---|---|---|
| 1 | AC 마다 테스트가 있나 | 부분 — R3·R5·R6·R8 |
| 2 | 레이어 배정 | 적절 — 컨트롤러는 실제 서비스·렌더러 + 포트만 대역(`AttractionPageControllerTest.kt:24-34`) |
| 3 | 목 경계 | 적절 — 과대 목 없음 |
| 4 | 테스트 데이터 전략 | 부분 — R2(정규화 규칙)·R7(고정 시계) |
| 5 | 부정·경계 사례 | 부분 — R3(본문 변경 → ETag 변경)·R4 |
| 6 | 네이밍 | 적절 — Kotest BehaviorSpec given/when/then(`test-rules.md:6`), vitest describe/it 한글 |

이슈 8건, 차단 없음.

## Findings

### R1 [체크 1·5] 바닥글 「최소안」은 패리티 검사가 아니다 — 최소안을 지우고 골든 방식으로 고정
- 스펙: SR-2.2 (`spec.md:20`) 「최소안: 각 쪽 테스트가 같은 4링크 리터럴을 단언」.
- 문제: 리터럴을 양쪽 테스트에 각자 적으면 기대값은 테스트가 만든 근거다. Kotlin `siteLinks()`(`AttractionPageRenderer.kt:656-663`)의 문구를 바꾸고 `AttractionPageRendererTest.kt:553` 리터럴만 같이 고치면, 프리렌더 쪽 테스트는 자기 리터럴과 자기 출력이 같으니 그대로 초록이다. 두 출력이 어긋나도 아무 테스트도 빨개지지 않는다. 전역 CLAUDE.md 「검사가 스스로 만든 근거는 근거가 아니다」에 해당한다.
- 선례가 이미 있다. `attractionJsonLdGolden.test.ts:372-376` 이 `copy.mjs` 실제 함수 출력을 `search/app/src/test/resources/render/jsonld-golden.json` 에 쓰고, `AttractionJsonLdParityTest.kt:37-38` 이 그 파일과 렌더러 출력을 비교하며, CI 가 `ci.yml:304-305` 에서 `git diff --exit-code` 로 골든이 최신인지 본다.
- 수정안:
  1. SR-2.2 에서 「최소안」 문장을 지우고 골든 방식 하나로 정한다.
  2. `prerender-seo.mjs` 의 `siteFooter`(`:471`, 지금 export 안 됨)를 export 하고, vitest 가 그 출력에서 `<a href label>` 목록을 뽑아 `search/app/src/test/resources/render/footer-links-golden.json` 에 쓴다.
  3. Kotlin 은 `renderer.attractionPage(...)` 출력의 `<footer>` 안 링크 목록을 같은 방식으로 뽑아 골든과 **순서까지** 비교한다(SR-2.1 이 「같은 순서·같은 문구」를 요구한다).
  4. `ci.yml` 의 JSON-LD 골든 단계 옆에 `git diff --exit-code -- search/app/src/test/resources/render/footer-links-golden.json` 한 줄을 더한다. 이 줄이 없으면 FE 만 고치고 골든을 안 올린 커밋이 통과한다.
  5. 회귀 주입: Kotlin `siteLinks()` 에서 링크 하나 제거 → Kotlin 패리티 빨강, `SITE_LINKS` 문구 하나 변경 → CI diff 단계 빨강. 두 방향 모두 본다.

### R2 [체크 4·1] 대장 파서의 정규화 규칙이 스펙에 없다 — 상수가 파서의 날것 출력에 맞춰 써질 수 있다
- 스펙: SR-1.4 (`spec.md:15`) 「각 행의 라이선스 문자열이 대장과 같다」.
- 대장 §1 표는 그대로 비교할 수 있는 모양이 아니다.
  - 라이선스 열 13칸이 반복 표시 `〃` 이다(`data-sources.md:69-77`). 세 칸은 부분 반복 `〃 (행마다 \`cpyrhtDivCd\`)` 이다(`:75-77`).
  - 굵게·코드 표기가 섞여 있다. `**행정구역(법정동)**`(`:89`), `**CC BY 4.0**`(`:90`), `**공공누리 제3유형(출처표시 · 변경금지)**`(`:87`).
- 정규화가 정해지지 않으면 파서를 느슨하게(`|` 로 쪼개 그대로) 짠 뒤 페이지 상수를 그 출력에 맞춰 `〃`·`**` 를 넣어도 게이트가 초록이다. 이때 게이트는 대장이 아니라 파서를 재고 있고, 공개 페이지에는 뜻 없는 `〃` 가 나간다.
- 수정안: SR-1.4 에 정규화를 명시한다.
  1. `**`·백틱을 벗긴다.
  2. `〃` 는 바로 위 행의 정규화된 값으로 펼친다. `〃 (…)` 는 위 값 + 괄호 부분으로 펼친다.
  3. 게이트에 부정 단언을 둔다. 페이지 상수의 어떤 칸에도 `〃`·`**`·백틱이 없고, 파싱된 모든 행의 라이선스가 빈 문자열이 아니다.

### R3 [체크 5] ETag 테스트 다섯 건이 「본문에서 나온 값」을 확인하지 않는다
- 스펙: SR-4.1 「본문 바이트의 SHA-256」, SR-4.3 (`spec.md:29`) 의 다섯 사례.
- 다섯 사례는 ETag 를 문서 id 해시나 상수로 만들어도 전부 통과한다. 그 구현은 재색인 뒤에도 옛 ETag 로 304 를 돌려 옛 본문을 고정한다. 컨트롤러 주석(`AttractionPageController.kt:44`)이 막으려는 바로 그 사고다.
- 수정안: 사례 하나를 더한다. `searchPort.findById("1001")` 가 첫 요청에 `doc()`, 두 번째에 개요만 바꾼 문서를 돌려주게 한다. 두 번째 요청에 첫 응답의 ETag 를 `If-None-Match` 로 실으면 200 이고, 본문에 새 개요가 있으며, ETag 가 달라야 한다.
- 함께 명시할 것:
  - 재요청에 쓰는 ETag 는 **첫 응답 헤더에서 읽는다.** 테스트 안에서 SHA-256 을 다시 계산해 비교하지 않는다. 그렇게 하면 구현 사본을 재는 것이 된다.
  - 같은 id 의 국문·영문 경로(`AttractionPageControllerTest.kt:56-64`)는 본문이 다르니 ETag 도 달라야 한다. 이 한 줄이 위 사례의 싼 대조군이다.

### R4 [체크 5] 폴백·404 에 `If-None-Match` 를 실은 사례가 없다
- 스펙: SR-4.3 「404·폴백엔 ETag 없음」.
- 「ETag 헤더 없음」만 보면, `checkNotModified` 를 분기 앞에서 부르는 구현이 정상 페이지의 ETag 를 받은 폴백 요청에 304 를 돌려줄 수 있는지를 확인하지 못한다. 그러면 OpenSearch 장애 중 브라우저가 캐시의 옛 정상 본문을 계속 쓰므로 장애가 감춰진다. 반대로 장애가 끝난 뒤 폴백 셸이 캐시에 남는 경우도 이 사례로만 잡힌다.
- 수정안: `searchPort.findById` 가 예외를 던지는 상태에서 정상 응답의 ETag 를 `If-None-Match` 로 보낸다. 결과는 200 · 셸 본문(`AttractionPageControllerTest.kt:104` 와 같은 단언) · ETag 없음이다. 404 에도 같은 사례 하나를 둔다.

### R5 [체크 1] 배포 뒤 검증이 측정 대상이 최신인지 먼저 확인하지 않는다
- 스펙: SR-4.4 (`spec.md:30`), SR-5 (`spec.md:33`).
- `curl` 결과에 ETag 가 없을 때 원인은 셋 중 하나다. 옛 search 이미지, nginx, Cloudflare 다. 최신성 확인이 없으면 Q1(`open-questions.yml:5`)을 「Cloudflare 가 지운다」로 잘못 닫을 수 있다.
- `/data-sources` 의 「200」은 옛 portal-fe 이미지에서도 나온다. SPA 폴백이 `index.html` 을 200 으로 내기 때문이다. 스펙의 「소프트 404 아님」은 판정 기준이 적혀 있지 않다.
- 수정안: SR-5 배포 뒤 절의 첫 단계로 다음을 둔다.
  1. search 쪽 최신성은 상세 SSR 본문에 이번에 새로 넣은 `href="https://1989v.com/data-sources"` 가 있는지로 본다. `ssh msa-oci` 로 배포 이미지 태그가 머지 커밋과 같은지도 한 줄 남긴다.
  2. portal-fe 쪽은 `/data-sources` 응답에 `<!--seo:prerendered-->` 표지와 대장 행 하나(예: `GeoNames`)가 함께 있어야 200 으로 친다. 그 두 문자열이 「소프트 404 아님」의 판정 기준이다.
  3. 둘 중 하나라도 없으면 그 측정은 버리고 Q1 을 기록하지 않는다.

### R6 [체크 1·5] 배포 뒤 `curl -sI` 는 약한 ETag 경로를 타지 않는다
- 스펙: SR-4.2 (`spec.md:28`) 가 nginx gzip 의 `W/` 변환 때문에 약한 비교를 고정하고, SR-4.4 는 `curl -sI` 로 확인한다.
- `curl` 은 `--compressed` 없이는 `Accept-Encoding` 을 보내지 않는다. 그러면 nginx 가 압축하지 않아 강한 ETag 가 그대로 나가고, SR-4.2 가 대비한 경로는 운영에서 한 번도 측정되지 않는다. `-I` 는 HEAD 라 실제 크롤러의 GET 과도 다르다.
- 수정안: 배포 뒤 확인을 압축 있음·없음 두 벌의 GET 으로 정한다.

```
curl -s -o /dev/null -D - --compressed https://place.1989v.com/attractions/1
curl -s -o /dev/null -D - https://place.1989v.com/attractions/1
```

  각 응답의 ETag 를 그대로 `If-None-Match` 로 실어 304 를 본다. origin 직접 측정도 같은 두 벌로 해서 Q1 표에 넣는다.

### R7 [체크 4] 컨트롤러 테스트의 시계가 고정돼 있지 않다
- `AttractionPageService` 는 `clock: Clock = Clock.systemUTC()` 기본값을 쓰고(`AttractionPageService.kt:17`) 오늘 날짜로 렌더한다(`:35`). 컨트롤러 테스트는 시계를 넘기지 않는다(`AttractionPageControllerTest.kt:31-33`).
- 「같은 ETag 로 재요청 → 304」는 두 요청의 본문이 바이트 단위로 같아야 성립한다. KST 자정을 걸치면 행사 상태가 바뀌어 간헐적으로 실패한다.
- 수정안: ETag 사례의 서비스 생성에 `Clock.fixed(...)` 를 넘긴다. 렌더러 테스트의 `TODAY` 픽스처와 맞춘다.

### R8 [체크 1] About·데이터 출처 프리렌더 본문을 vitest 가 부를 함수가 없다
- 스펙: SR-5 (`spec.md:33`) 「vitest(… About 프리렌더 본문)」, SR-3 「`/data-sources` 프리렌더 본문은 표 전체」.
- 포털 페이지 프리렌더 본문은 `main` 루프 안에서 조립돼 `emit` 으로 바로 쓰인다(`prerender-seo.mjs:1608-1628`). export 된 렌더 함수가 없어서 vitest 로 검증할 대상이 없다. 남는 것은 `npm run build` 뒤 `dist/` 확인인데, 이것은 수동이고 CI 에서 돌지 않는다.
- 데이터 출처 표에는 사본이 하나 더 생길 수 있다. 스펙은 행 데이터를 「페이지의 TS 상수」로 둔다(SR-1.3). 그런데 `.mjs` 프리렌더는 `.tsx` 페이지를 import 하지 못한다. 그러면 프리렌더 표가 별도 사본이 되고, SR-1.4 게이트는 페이지 상수만 대조하므로 그 사본은 검사 밖에 놓인다. 크롤러가 보는 쪽이 바로 그 사본이다.
- 수정안:
  1. `/tech/search` 의 `renderTechSearchHtml`(`:1647`) 선례처럼 `renderDataSourcesHtml(shell)`·`renderAboutHtml(shell)` 을 export 한다.
  2. 행 상수는 `copy.mjs` 또는 별도 `.mjs` 데이터 모듈 하나에 둔다. 페이지와 프리렌더가 둘 다 그것을 import 하고 게이트도 그것을 대조한다. SR-3 이 About 문구를 `copy.mjs` 로 옮기는 것과 같은 이유다.
  3. vitest 는 export 한 함수의 출력에서 `<tr>` 수가 상수 행 수와 같은지, About 각 절 텍스트가 들어 있는지를 본다. 단언의 기대값은 상수에서 꺼내고 리터럴로 적지 않는다.

## 참고 (판정에 넣지 않음)
- SR-1.4 게이트는 「데이터」 집합과 라이선스만 대조하고 「원천」 열은 대조하지 않는다. 페이지는 세 열을 공개하므로(SR-1.2) 원천 열이 바뀌어도 게이트는 초록이다. 결정 ③ 「어긋나면 실패」를 세 열 모두로 읽는다면 원천 열도 대조에 넣는다. 정규화는 R2 와 같다.
- 회귀 주입 「대장에 행 추가」(SR-5)는 공유 트리의 대장을 직접 고치지 않는 편이 낫다. 게이트의 비교를 `compare(ledgerText, rows)` 처럼 텍스트를 받는 함수로 짜면, 행을 하나 더한 텍스트를 넣어 불일치가 보고되는지를 상설 부정 테스트로 둘 수 있다. 그러면 주입이 한 번으로 끝나지 않고 계속 남는다.
- 런타임 `Footer.tsx` 의 데이터 출처 링크(SR-2.3), sitemap·llms 한 줄(SR-1.1), `nginx.conf:145` 정규식 변경은 SR-5 의 vitest 목록에 이름이 없다. nginx 는 R5 의 배포 뒤 확인이 덮는다. sitemap 은 `prerender-seo.mjs:687` 목록에 단언 하나를 더하면 충분하다.

VERDICT: REVISE
