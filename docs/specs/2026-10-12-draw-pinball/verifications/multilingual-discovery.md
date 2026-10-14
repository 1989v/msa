# Multilingual game discovery — 2026-10-15

Scope: approved ko/en public draw and marble-race introduction, metadata, initial HTML, internal links and privacy boundaries. Workspace `/Users/gideok-kwon/.codex/worktrees/d3c3/msa`. No game-internal or physics changes; six historical untracked live QA artifacts were preserved.

## Implementation

- `gameEditorial.mjs` supplies bilingual marble copy and verified six-course/automatic-draw/replay instructions, plus public draw copy. API display helpers, SEO metadata, JSON-LD, prerender and llms introduction reuse the same source. Other games retain their description/language fallback.
- `/draw` and `/en/draw` have public localized initial HTML, self-canonical, ko/en/x-default and sitemap lastmod 2026-10-15. Marble details and changed hub also use actual edit dates. DECIDER genre now participates in prerender enumeration. Root/genre/detail/draw link to the public discovery pages using anchors; the root still describes the full 82-game catalog.
- Public guide stays after draw inputs/start/invitation actions. No participant names, local drafts or room state enter static generation or sitemap.
- Discovered preexisting privacy gap: PartyPage had no noindex, and the shared hook retained prior public canonical. Parent approved generic private metadata, explicit `canonical: null` removal, actual party-route HTTP noindex and root invitation presence mapping. Undefined canonical still preserves prerender metadata. Root query handling uses immutable `$request_uri`, avoiding the review-discovered `try_files`/mutable `$uri` bug. New routes preserve stricter host noindex/nofollow policies.

## Verification evidence

Focused Vitest command selected `copy`, `gameSitemap`, `prerenderGames`, `multilingualGames`, `useSeoFeeds`, `DrawPage`, `GameAboutPanel.guide`, `GamesPage.seo` and `PartyPage.invite` test files:

```text
Test Files  9 passed (9)
     Tests  91 passed (91)
Duration  1.24s
```

Covers old API overrides, other-game fallback, ko/en visible introduction and initial HTML, metadata/canonical/hreflang/discovery anchors, escaping through existing prerender tests, dates/private URL exclusion, draw input/start/storage recovery and invitation regressions. Includes explicit unknown-canonical preservation, private clearing and public restoration.

Touched-file ESLint: exit 0, no errors. Existing warning: GameDetailPage.tsx:139 `stageRef.current` effect-cleanup reference (`react-hooks/exhaustive-deps`). Final hook/privacy/test delta lint: exit 0, no output.

Final semantic-source `npm run build` (includes render-content and `tsc -b`): exit 0.

```text
✓ built in 2.37s
[seo] 프리렌더 188개 페이지 · 게임 82종 (https://api.1989v.com)
[html] 주석 제거 896개 파일 · 1417.1KB 절감
```

Final built-output readback:

```text
PASS built initial HTML + sitemap ko /draw
PASS built initial HTML + sitemap ko /games/marble-race
PASS built initial HTML + sitemap en /draw
PASS built initial HTML + sitemap en /games/marble-race
PASS sitemap private state exclusion
```

Actual local nginx (existing `nginx:alpine` image; production envsubst setup):

```text
nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
nginx: configuration file /etc/nginx/nginx.conf test is successful
PASS: 26 real nginx responses including stricter host nofollow on draw and party
```

Request/status/header evidence: [multilingual-nginx-http.json](multilingual-nginx-http.json). This uses actual renderHub/renderDraw/renderDetail HTML generated from a small legacy-description fixture and the built SPA shell. It verifies root prerender `try_files`, root `r` valid/empty/bare/duplicate/encoded-key variants, normal root/query/en/draw/detail controls, party ko/en/code paths, raw frame, apex exclusion and resume/ads host policy. Container was stopped. This is CLI HTTP validation, not browser UI or live production validation.

`git diff --check`: exit 0. Installed hns `doc_scan.py --base HEAD`: exit 0, no mapped-document impact; reports existing FE files/new helpers as unlinked. Updated this existing spec, tasks, decisions and progress; no unrelated doc-index/lock rewrite.

## Review and limits

Parent's fresh reviewer returned SHIP for the content/route candidate, stable request-uri fix and final stricter-host header delta (26 actual HTTP responses). Parent handles final integration, push/deploy and operating HTTP checks. No browser approval existed, so no UI automation was performed. Physical/finish matrices were not repeated because physics and game internals were unchanged.

Search Console/Search Advisor submission/index inspection and actual query impressions/clicks/position require account access and have not been performed. Search-engine crawling, indexing, snippet choice and ranking remain external outcomes; no visibility or ranking gain is claimed. The 26 HTTP cases are fixtures, while built-output readback used the final live-API-generated 82-game build.

## Production deployment and HTTP verification — 2026-10-15 KST

- Source pushed to main: `ecc1d311b9ce6a2cec4424bbcec345f22a1a5cb0`; includes the shared convention/AGENTS reference and plan committed immediately before it. Local feedback memory and both memory indexes were read back separately; they are not repository files.
- [Images workflow](https://github.com/1989v/msa/actions/runs/38629118508): completed **success**. Production portal image `ap-chuncheon-1.ocir.io/axyooxbyk5yv/portal-fe:ecc1d31`; deployment generation/observed `575/575`, available replicas `1`; rollout successful.
- **12 actual public HTTP checks passed**, recorded in [multilingual-live-http.json](multilingual-live-http.json). Four edited ko/en URLs have localized initial titles, main content, self-canonical and reciprocal ko/en/x-default. All four are in the production sitemap with lastmod `2026-10-15`; private URLs are excluded.
- The Korean marble initial body contains all five requested phrases and current six-course copy; old three-course/awkward wording is absent. The English initial body contains pinball game, pinball raffle, pinball draw and friendly pinball bets; the English draw covers party decision games/friendly betting games through its shared copy.
- Normal root and public draw/details are indexable. Valid/empty/encoded-key root invites, ko/en party pages and raw game frame return actual HTTP `X-Robots-Tag: noindex, follow`.
- These are HTTP/HTML/header checks without JavaScript UI execution, room creation, browser control or clipboard writes. They confirm deployed crawlable content and policy, **not search-engine indexing or rankings**. Search Console/Search Advisor submissions and private performance metrics remain unperformed.
