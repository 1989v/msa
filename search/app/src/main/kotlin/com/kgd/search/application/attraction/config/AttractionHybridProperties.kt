package com.kgd.search.application.attraction.config

import org.springframework.boot.context.properties.ConfigurationProperties

/**
 * 관광지 하이브리드 검색 (ADR-0090 D4). **기본은 꺼짐** — 사전과 문서 벡터가 다 찬 뒤에 켠다.
 *
 * 융합 방식은 아직 확정이 아니다(ADR-0090 D5-1). P0 실측에서 하이브리드가 **질의마다 방향이 갈렸다**:
 * 뜻으로 묻는 질의는 크게 올랐지만(`야시장` +0.513), BM25 가 이미 잘 하던 이름 질의는 내려갔다(`한옥` −0.270).
 * 그래서 [fusion] 을 설정으로 두고 P1 에서 A/B 로 고른다 — 코드를 고치지 않고 파이프라인만 바꾼다.
 */
@ConfigurationProperties(prefix = "search.attraction-hybrid")
data class AttractionHybridProperties(
    val enabled: Boolean = false,
    /** 벡터 레그가 훑는 이웃 수. 너무 작으면 뒤 페이지에서 벡터 결과가 끊긴다. */
    val k: Int = 100,
    /** 융합 방식 — 파이프라인 이름의 접미가 된다. `rrf` 외의 값은 그 이름의 파이프라인이 있어야 한다. */
    val fusion: String = "rrf",
) {
    /** 검색 파이프라인 이름. 이 이름의 파이프라인이 없으면 OpenSearch 가 요청을 거부한다. */
    val pipeline: String get() = "attraction-hybrid-$fusion"
}
