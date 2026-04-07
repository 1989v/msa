# Engineer Review: Client-Side OCR Migration

> Reviewer: Claude Opus 4.6 (Senior Code Reviewer)
> Date: 2026-04-07
> Spec: `docs/specs/2026-04-07-client-side-ocr/spec.md`

---

## 1. Completeness

**Verdict: REVISE**

### Covered well
- Frontend OCR module structure, engine lifecycle, preprocessing, and parsing are all specified.
- Backend deletion scope (`OcrPort`, `OcrClientAdapter`, `docker/ocr/`) is accurate and matches the actual codebase.
- Migration phases (A-D) give a clear execution order.
- Rollback plan exists.

### Gaps found

**[Important] `RegisterGifticonUseCase.Result.ocrRawText` removal not addressed.**
The spec (Section 6.3) mentions "응답에서 `ocrRawText` 필드 제거" but does not track the actual change needed in `RegisterGifticonUseCase.Result` (line 23 of the use case). This is a compile-breaking change that propagates to the controller response DTO and potentially to the frontend `Gifticon` type. The spec should list every file that references `ocrRawText` and confirm whether the frontend ever uses it.

**[Important] `RegisterGifticonUseCase.Command.imageBytes` still required?**
Currently the server receives the raw image bytes in the command to (a) store the image and (b) pass to OCR. After this migration, the image is still stored server-side, so `imageBytes` stays -- but this should be explicitly confirmed in the spec since the spec's language ("메타데이터만") could be misread as removing image upload.

**[Suggestion] No mention of `OcrConflictModal` usage in existing SyncEngine.**
The spec says OcrConflictModal is preserved but not called. However, the spec does not trace where it is currently triggered. A grep confirms no SyncEngine or RegisterGifticonPage code currently invokes it -- so this is accurate, but worth documenting that it was already dead code even before this migration.

**[Suggestion] `gifticon.ocr.url` config property cleanup.**
`OcrClientAdapter` reads `gifticon.ocr.url` from config. The spec should mention removing this from `application.yml` / `application-docker.yml` and the docker-compose environment variable `OCR_SERVICE_URL`.

---

## 2. Consistency (with Clean Architecture and module structure)

**Verdict: SHIP**

### Architecture alignment
- The migration correctly removes an outbound port (`OcrPort`) and its infrastructure adapter (`OcrClientAdapter`) from the application layer -- this is a clean removal that follows the Port & Adapter pattern.
- The dependency direction is preserved: the frontend handles OCR, the backend Application layer no longer depends on OCR infrastructure.
- The Domain layer (`gifticon/domain/`) is completely unaffected -- `Gifticon.create()` already accepts plain strings for brand/barcodeNumber/expiryDate.
- Frontend OCR module placement under `gifticon/frontend/src/ocr/` is a reasonable feature-first structure.

### No conflicts detected
- The `TextParser.ts` is a pure function module with no framework dependency -- analogous to the Domain layer's "no framework" principle applied to the frontend.
- `GifticonService` modification (removing `ocrPort` dependency) simplifies the constructor injection, which is a clean improvement.

---

## 3. Feasibility

**Verdict: REVISE**

### Sound technical choices
- Tesseract.js with `tessdata_fast` for Korean + English is a proven combination.
- Web Worker execution prevents main thread blocking -- correct approach.
- Canvas-based preprocessing (grayscale, contrast, resize) is standard and well-supported.
- Cache-first strategy for WASM/traineddata via Service Worker is the right pattern.

### Issues to address

**[Critical] Service Worker has no cache infrastructure yet.**
The current `sw.ts` uses only `precacheAndRoute` from Workbox for static assets and handles push/sync events. It has zero runtime caching routes. The spec assumes "기존 `service-worker.ts`에 OCR 모델 캐싱 로직 추가" but what's actually needed is adding a Workbox `registerRoute` with a `CacheFirst` strategy for the Tesseract CDN URLs. This is doable but the spec should acknowledge this is net-new Service Worker caching logic, not a simple extension.

**[Important] Tesseract.js CDN vs self-hosted not decided.**
The spec says "CDN 또는 self-hosted에서 로드" (Section 2.2) but leaves this open. This is a deployment decision that affects:
- CORS configuration (CDN may need crossorigin headers)
- Offline reliability (CDN URLs may change)
- Bundle size if self-hosted
This should be decided before implementation, not left ambiguous. Recommendation: self-host in the PWA's `/static/` and let Workbox precache handle it.

**[Suggestion] 30-second idle timeout for Worker termination may be aggressive.**
If a user selects multiple images in sequence (re-selecting after reviewing OCR results), the Worker would be created and destroyed repeatedly. Consider a longer timeout (60-120 seconds) or keeping the Worker alive while on the RegisterGifticonPage.

---

## 4. Testability

**Verdict: REVISE**

### Adequate coverage
- TextParser unit tests at P0 with 100% coverage target is correct -- this is the ported business logic.
- Backend test updates for `GifticonService` (removing OCR mock) are straightforward.
- Quality gate requiring 3+ real gifticon images for manual E2E is practical.

### Gaps

**[Important] No accuracy regression test baseline.**
The spec ports `app.py` logic to TypeScript but has no mechanism to verify parity. The test strategy should include a "golden file" test: run the same set of OCR raw text samples through both the Python parser and TypeScript parser and assert identical output. This is a one-time verification that the port is faithful.

**[Important] OcrEngine integration test is underspecified.**
The test strategy lists "이미지 -> 전처리 -> OCR -> 파싱 E2E" with "Vitest + Tesseract.js" but Tesseract.js in a Node/Vitest environment requires `tesseract.js-core` and can be slow (~10s per image). The strategy should clarify:
- Whether this test runs in CI or is manual-only
- What test images are used (synthetic or real)
- Acceptable accuracy threshold (exact match? fuzzy?)

**[Suggestion] No test for Service Worker caching behavior.**
Verifying that the WASM and traineddata files are cached correctly after first load is important for the offline promise. Consider a Playwright test that loads the page, triggers OCR, goes offline, and verifies OCR still works.

---

## 5. Risk

**Verdict: SHIP**

### Risks are well-identified
The three risks in Section 10 (accuracy, OOM, iOS Worker) are the real ones. The mitigations are pragmatic.

### Additional observations

**[Suggestion] Add risk: TextParser regex parity.**
If the TypeScript regex engine handles Korean Unicode differently from Python's `re` module, edge cases in date/brand extraction could diverge. This is low probability but worth noting since Korean text with mixed encodings can behave differently.

**[Suggestion] Add risk: Tesseract.js version pinning.**
Tesseract.js v5 has breaking API changes vs v4. The spec should pin a specific version range to avoid surprises during implementation.

Overall, the risk section is realistic and does not overstate or understate threats. The rollback plan (git history restoration) is sufficient for a feature of this scope.

---

## Summary

| Dimension | Verdict | Blocking Issues |
|-----------|---------|-----------------|
| Completeness | REVISE | `ocrRawText` removal cascade not traced; config cleanup missing |
| Consistency | SHIP | Clean Architecture alignment is correct |
| Feasibility | REVISE | Service Worker caching is net-new (not extension); CDN vs self-host undecided |
| Testability | REVISE | No parser parity test; integration test execution environment unspecified |
| Risk | SHIP | Risks are realistic and mitigations are adequate |

### Required actions before implementation

1. **Trace `ocrRawText` removal** through `RegisterGifticonUseCase.Result`, controller response DTO, and frontend types. Add affected files to the spec's "Affected Components" table.
2. **Decide CDN vs self-hosted** for Tesseract WASM/traineddata. Recommend self-hosted.
3. **Acknowledge Service Worker caching** is new Workbox `registerRoute` logic, not a trivial addition. Spec Section 4 should include a code sketch for the caching route.
4. **Add golden-file parity test** to test strategy: same raw text inputs through Python and TypeScript parsers must produce identical outputs.
5. **Remove `gifticon.ocr.url`** from application config and `OCR_SERVICE_URL` from docker-compose environment. Add to spec Section 7.
