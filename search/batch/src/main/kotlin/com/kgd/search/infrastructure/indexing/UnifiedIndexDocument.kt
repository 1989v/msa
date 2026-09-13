package com.kgd.search.infrastructure.indexing

import com.fasterxml.jackson.annotation.JsonIgnoreProperties
import com.fasterxml.jackson.annotation.JsonInclude

/**
 * `unified` 인덱스 색인 문서 — 관광지를 **뺀** 나머지 타입(글·게임·개념·혜택·서비스·상품).
 * 필드 정의는 `opensearch/unified-index.json` 이 SSOT.
 *
 * 관광지는 여기 싣지 않는다 — 6만 벡터를 두 번 실으면 k-NN 메모리가 두 배라 무료 티어 밖이고,
 * 그쪽 장치(쿼리 언더스탠딩·가중치·하이브리드)는 `attractions` 인덱스에 그대로 산다.
 * 통합 검색 API 가 둘을 부르고 타입별로 묶어 낸다 (플랜 §2 S4).
 *
 * URL 은 굽지 않는다 — FE 가 `type` + `slug` 로 `serviceHref.ts` 에서 조립한다.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
data class UnifiedIndexDocument(
    /** `{type}:{sourceId}` */
    val id: String,
    val type: String,
    val sourceId: String,
    val slug: String,
    val lang: String,
    val title: String,
    val titleEn: String? = null,
    val summary: String? = null,
    /** 검색용 평문 — 글은 마크다운을 벗긴 것 */
    val body: String? = null,
    val category: String? = null,
    val tags: List<String> = emptyList(),
    /** 타입별 필터 축. 타입마다 컬럼을 늘리지 않는다 — `flat_object` 라 `facets.genre` 로 걸린다 */
    val facets: Map<String, String> = emptyMap(),
    /** 타입 안에서 log1p 로 눌러 둔 인기도. 타입 간 비교에는 쓰지 않는다 */
    val popularity: Float = 0f,
    val publishedAt: String? = null,
    val thumbnailUrl: String? = null,
)
