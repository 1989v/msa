# P1 implementation report — 2026-10-21

Scope: approved location-free C01/C02/C03 only. No computer use, commit, push, deployment, schema change, build-configuration change or lockfile change was performed. The parent’s independent read-only re-review reported SHIP after four findings were corrected.

## Implemented

- C01: two-line heading, controlled large search, six type tiles with row counts, official 0mg / decaf / sugar ≤10g links, official-source disclosure.
- C02: compact search and committed controls, local draft filter modal with focus trap/Escape/cancel, basis segment and sort, full-result/page-range summary, one sticky four-column table, ochre text-safe brand labels, wrapping menu names, variant metadata, right-aligned tabular numbers with units, sorted metric emphasis, explicit previous/next pagination.
- C03: stable variant lookup, brand/menu/temperature/size/volume/caffeine status, three metric columns, raw serving basis, price-disclosure state, menu-name type classification, date, extra nutrient/raw values/notes/allergens, official source, basic-recipe notice.
- No nearby UI. Heritage semantic --ko/--kh tokens only; no hardcoded hex or nutritional good/bad colors.
- Requests are driven by submitted URL state; Korean composition and modal draft changes do not mutate the URL. Back from detail restores the cached list URL, basis/page, scroll and selected-link focus.
- Loading/error/empty states are exclusive; partial metadata errors retain results; 100ml shows current-page volume coverage and all-unavailable recovery; 기타 is explicitly unclassified.

## API contract

- GET `/api/v1/ranking/cafe/drinks`: existing fields preserved; default size 20, maximum 200. `basis=serving|100ml` and repeated `caffeineStatus=ZERO|DECAF|DISCLOSED|UNDISCLOSED` added. `sort=sugar|caffeine|kcal` follows basis. Legacy `sort=sugarPer100ml` remains the concentration alias. `maxSugar`/`maxCaffeine` always apply to original per-serving amounts; null numeric values are excluded, and undisclosed caffeine is excluded from caffeine upper bounds.
- `caffeine=zero` selects ZERO, `caffeine=decaf` selects DECAF, `caffeine=none` retains ZERO+DECAF compatibility. A legacy caffeine filter combined with any explicit status returns 400; invalid basis/sort/range also returns 400 through the controller’s Spring error response.
- Every response adds `drinkKey`. Existing domain-derived three per100ml values remain positive-cup-volume only. Sorting calculates raw numerator ×100/cup_volume_ml in SQL before pagination instead of sorting the four-decimal stored display derivatives. Missing/nonpositive volume produces null, sorted last. No in-page filtering/reordering remains.
- GET `/api/v1/ranking/cafe/drinks/{drinkKey}`: exact natural-key lookup, full response, malformed/deleted/unmatched key 404.
- `drinkKey` is `v1_` plus URL-safe Base64 of length-prefixed UTF natural-key fields (brandSlug/menuName/temperature/sizeLabel/caffeineStatus). It survives delete/reimport and numeric/source-date updates. Menu/variant identity changes intentionally invalidate the old key. Existing DB semantics normalize null temperature/size to empty; the key matches those semantics and does not introduce a new distinction.
- **§8.1 implementation difference (review point):** ties order by brandSlug/menuName/temperature/sizeLabel/caffeineStatus in SQL, before pagination. This is stable across reimport, but is not literal lexical ordering of the opaque Base64 drinkKey. Avoids schema or database-specific encoding expressions.
- ADR-0083 boundaries remain `application/cafe/{usecase,port,service,dto}` → infrastructure adapter/query repository; domain key has no framework dependency.

## SEO

`copy.mjs` owns the plan §9 title/description. `/cafe` has a self canonical, host-scoped initial HTML at `prerender/_hosts/rank.1989v.com/cafe.html`, nginx `_hosts/$host/cafe.html` lookup, and canonical-only sitemap entry. Query combinations are noindex both in live metadata and nginx X-Robots-Tag before hydration. Detail uses a self canonical with noindex and is excluded from the sitemap. Prerender output is verified as a pure HTML function; a production build/deployed HTTP request was outside the allowed checks.

## Verification evidence

- Baseline `cd portal-fe && npx vitest run src/pages/rank src/seo`: exit 1; `Test Files  2 failed | 28 passed (30)`; `Tests  3 failed | 313 passed (316)`. Log `/tmp/cafe-p1-baseline.log`.
- Post-change same command: exit 1; `Test Files  2 failed | 30 passed (32)`; `Tests  3 failed | 324 passed (327)`. Log `/tmp/cafe-p1-post.log`. All 11 added tests pass; failure names are unchanged:
  - `src/seo/__tests__/footerLinksGolden.test.ts > 바닥글 링크 골든 > 호스트 여섯 + 신뢰 링크 넷 = 열 개`
  - `src/seo/__tests__/gameCatalogGuides.test.tsx > all 82 catalog games share complete initial/live instructions and unique titles: ko`
  - Same `gameCatalogGuides` case for `en`.
- `./gradlew :ranking:domain:test :ranking:feature:test --no-daemon --console=plain`: exit 0; `BUILD SUCCESSFUL in 32s`; `21 actionable tasks: 4 executed, 17 up-to-date`. XML results: domain 129 tests / 0 failure / 0 error / 0 skipped; feature 30 / 0 / 0 / 0. Log `/tmp/cafe-p1-gradle.log`. Includes real H2 Querydsl raw-ratio sorting (ratios that round identically), missing-volume/null-last/page boundaries, state/alias filters, upper-bound basis, and stable exact detail-key tests.
- `cd portal-fe && npx tsc -b`: exit 0, no diagnostics. Log `/tmp/cafe-p1-tsc.log` (empty successful compiler output). The check was rerun after correcting JSDoc inference on optional detail key.
- `git diff --check`: exit 0.
- One mistaken `npx vitest` invocation from the repository root failed before tests with npm cache EPERM; corrected to portal-fe. No npm/cache/config permissions were changed.

## Acceptance status

| ID | Status and evidence/limit |
|---|---|
| P1-1 | Implemented responsive fixed table, wrapping text, no nested horizontal scrollers. **Viewport overflow measurement unverified**: no computer-use approval. |
| P1-2 | Compact controls and modal filter implemented. **360×800 initial row visibility / 1280×800 / 200% zoom unverified**. |
| P1-3 | Implemented units and explicit missing temperature/size, nullable metric labels, official-zero/decaf distinction. Unit/component tests cover representative states; no browser visual verification. |
| P1-4 | Verified raw basis sort, three per100 metrics, positive-volume guard, missing-volume retained/null last, per-page coverage/recovery. |
| P1-5 | Verified ZERO-only, DECAF-only, repeated union, legacy none, null upper-bound exclusion. |
| P1-6 | Verified server-wide sorting before pages, total count independent of limit. UI shows total and visible range; no missing-brand/sales inference. Stable natural-key tie order deviation noted above. |
| P1-7 | Component regressions verify Korean composition draft, one submitted request, zero modal draft requests, one applied request, back URL/basis/page/focus restoration; scroll restoration implementation present. |
| P1-8 | Loading/error/empty/meta-failure/missing-volume fixtures verified. Modal Escape/focus restoration and detail-link return verified programmatically. **Full keyboard-only browser journey unverified**. |
| P1-9 | **Unverified**: 3 tasks ×5 human participants/time/accuracy evaluation not performed. |
| P1-10 | Dedicated initial HTML metadata and host route/noindex/sitemap contracts verified in tests. **Built/deployed HTTP verification unperformed** under scoped command restriction. |

## Generated test side effect

`footerLinksGolden.test.ts` writes `search/app/src/test/resources/render/footer-links-golden.json` even when its count assertion fails. This accounts for the initially unexplained fixture diff after the baseline command; it was generated by the required test, not another contributor. The workspace was clean before baseline. Restored that generated fixture from HEAD after the final test, preserving the pre-task contents and keeping the unrelated preexisting failure untouched. No generated/prerequisite/config/lock artifacts remain.

## Changed files (this implementation)

- `docs/specs/2026-10-21-cafe-compare-redesign/implementation-report.md`

- `portal-fe/nginx.conf`
- `portal-fe/scripts/prerender-seo.mjs`
- `portal-fe/src/App.tsx`
- `portal-fe/src/api/rankingApi.ts`
- `portal-fe/src/pages/rank/CafePage.css`
- `portal-fe/src/pages/rank/CafePage.tsx`
- `portal-fe/src/pages/rank/__tests__/CafePage.test.tsx`
- `portal-fe/src/pages/rank/__tests__/cafeUrl.test.ts`
- `portal-fe/src/pages/rank/__tests__/cafeView.test.ts`
- `portal-fe/src/pages/rank/cafeUrl.ts`
- `portal-fe/src/pages/rank/cafeView.ts`
- `portal-fe/src/seo/__tests__/cafeSeo.test.ts`
- `portal-fe/src/seo/copy.mjs`
- `ranking/domain/src/main/kotlin/com/kgd/ranking/domain/cafe/model/CafeDrinkKey.kt`
- `ranking/domain/src/test/kotlin/com/kgd/ranking/domain/cafe/model/CafeDrinkKeyTest.kt`
- `ranking/feature/src/main/kotlin/com/kgd/ranking/application/cafe/dto/CafeDrinkDtos.kt`
- `ranking/feature/src/main/kotlin/com/kgd/ranking/application/cafe/port/CafeDrinkRepositoryPort.kt`
- `ranking/feature/src/main/kotlin/com/kgd/ranking/application/cafe/service/CafeDrinkService.kt`
- `ranking/feature/src/main/kotlin/com/kgd/ranking/application/cafe/usecase/CafeDrinkUseCases.kt`
- `ranking/feature/src/main/kotlin/com/kgd/ranking/infrastructure/persistence/adapter/CafeDrinkRepositoryAdapter.kt`
- `ranking/feature/src/main/kotlin/com/kgd/ranking/infrastructure/persistence/repository/CafeDrinkQueryRepository.kt`
- `ranking/feature/src/main/kotlin/com/kgd/ranking/presentation/controller/CafeDrinkController.kt`
- `ranking/feature/src/test/kotlin/com/kgd/ranking/CafeDrinkQueryRepositoryTest.kt`
