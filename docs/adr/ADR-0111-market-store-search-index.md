# ADR-0111 — Market store dedicated search index

## Status
Accepted (2026-10-17), WU-28a. [P7 §9](../specs/2026-10-15-market-store-map/p7-plan.md#9-가게-검색을-검색엔진으로-제안-2026-10-17--결정-대기) and the approved task define the scope. This ADR supersedes the older draft endpoint and nori user-dictionary proposal.

## Context (§9.1)
The market section uses browser substring matching. The market directory uses whitespace-normalized MySQL LIKE over `market_store_search` (12,606 rows in the planning snapshot; the batch logs the actual current count). Neither supplies typo tolerance, morphological tokenization, field scores, or dictionary-driven bilingual food matching. Source ownership stays with place (ADR-0109/0110); search must not access its database.

## Options (§9.2)
- **A: dedicated OpenSearch `market-stores` index.** Nori, English analysis, name/roman typo tolerance, weighted relevance, market aggregation. Requires a daily batch and search API; freshness follows that batch.
- **B: MySQL FULLTEXT ngram over `market_store_search`.** Smaller change and immediate freshness, but cannot provide the requested typo tolerance and dictionary expansion.

## Decision (§9.3)
Choose A. Keep the index separate from attractions and unified search so store volume does not dominate the apex search. No new permanent pod or network policy is required. Use ADR-0083 UseCase interface → application outbound port → infrastructure adapter; directories match packages.

### Index and analyzers
Alias `market-stores` points to `market-stores-yyyyMMdd-HHmm`. One document joins Korean and English projections by store ID: `contentId`, `marketName`, `storeId`, `name`, `nameRoman`, `nameEn`, `items`, `itemsEn`, `categoryMajor/Mid/Sub` and their `En` counterparts, `menus`, `dishes`, `dishesEn`, `membership`, `nearby`, optional `location` (`geo_point`), `zoneId`, `pathId`. Missing coordinates omit location while preserving the document. Mapping SSOT is `search/batch/src/main/resources/opensearch/market-stores-index.json`; writing and reading classes stay independent with identical fields.

Korean fields use nori without a user dictionary; English fields use `english`; roman uses `standard`. There is no copied synonym file. The sole dictionary is place's dishes.csv, fetched through `GET /api/v1/place/markets/dishes`. Batch expansion matches normalized item/menu food names and exact categorySub and adds Korean and English dish terms. `AUTO` fuzziness is limited to name/nameEn/nameRoman. Weights: name/roman 4, dishes 3, items 2, menus 2, categories 1; English queries double En-field weights. Named clauses produce `matchedBy` (`NAME`, `ITEMS`, `MENU`, `CATEGORY`, `DISH`, `ROMAN`).

The current place response has no nameRoman. It remains absent, without inventing a transliteration; the existing nameEn remains searchable with name fuzziness. place supplies one categoryEn translated from categorySub, else categoryMid, else categoryMajor; it fills only that corresponding En field. Remaining levels remain absent. Batch logs missing nameRoman and categoryEn counts. No place modification is included.

### API
`GET /api/v1/search/market-stores?q&contentId&lang&page&size` returns ApiResponse data `{items:[{storeId,contentId,matchedBy,score}],total,markets:[{contentId,marketName,count}]}`. `contentId` filters one market and defaults size to 200; otherwise size defaults to 20 and terms aggregation returns matching-market counts (up to 1,000 markets). lang is ko/en; page starts at 0, size is 1–200, the result window is capped at 10,000, and q must contain 1–200 nonblank characters. The gateway has an exact route ordered ahead of the `/api/v1/search/**` atlas route.

### Batch and failure safety
`marketStoreApiReindexJob` uses the existing tasklet/job/listener framework and IndexAliasManager atomic alias swap and two-index retention, including the existing 90% live-document completeness floor. CronJob `market-store-reindex` runs daily at 21:40 UTC, ten minutes after attraction-reindex, using the same image, labels and network permissions.

Fetch `/api/v1/place/markets/content-ids`, then each `/api/v1/place/markets/{contentId}?lang=ko` and `?lang=en`. Use the public default projection, including IN/UNKNOWN and nearby fallback stores; UNKNOWN/missing-coordinate rows remain searchable. Both language responses must succeed for a market. Empty IDs, absent/null API data and empty runs fail safely. More than 5% failed market fetch/conversions fails the step before swapping; exactly 5% is accepted. The final bulk flush shares a monitor with periodic/threshold primary sends, joining already drained in-flight requests before checking errors. After this completion barrier the listener independently rejects more than 5% bulk errors and marks the job FAILED. Both checks precede alias mutation. Failed indices are not published; subsequent successful retention cleanup removes older timestamped indices.

### FE fallback and verification
WU-28a has no FE changes. The follow-up FE integration uses a 300ms debounce and store-ID highlights; unavailable, malformed or empty API responses retain the current browser `matchesMarketStore` fallback. Existing rendering continues to use place projections.

Focused Kotest BehaviorSpec/MockK checks cover bilingual conversion, dishes expansion, absent location, mapping/write symmetry, failure threshold and untouched alias, English priority, name-only fuzziness, query filters and controller bounds. There is no existing OpenSearch Testcontainers fixture in search, so real typo/spacing ranking and the proposed 30-query Recall@10 evaluation remain operational follow-up. Scoped test, compile and kustomize outputs are saved as `/tmp/wu28a-{domain,app,batch,compile,kustomize}.log` during implementation. The global build contract gate currently enumerates four existing indices; build configuration and lockfiles remain outside this task. A local contract test covers the new write mapping; read shape is kept identical.

## Consequences and rollback
The dedicated index adds daily API traffic and modest storage (planning estimate 10–20 MB, to be measured). Edited stores become searchable after the next successful batch, while place's map is immediately current. Dictionary expansion can broaden category matches, so production relevance must be evaluated before FE activation. Missing source romanization and unprovided category translations constrain bilingual recall.

Rollback: suspend the market-store CronJob, restore a retained index through the alias if needed, or delete the market-stores alias/indices and use the current FE browser fallback. Deleting the index is an explicit operational action, not part of this implementation. No attractions/unified indices or place source data change.

## References
- [Layer structure](ADR-0083-layer-structure-standard-and-gate.md)
- [Market source protection](ADR-0109-place-market-store-map.md)
- [Market geometry](ADR-0110-market-alley-geometry-osm.md)
