package com.kgd.search.application.queryvector.usecase

/**
 * 질의 → 벡터 (ADR-0090). 사전에 있으면 벡터, 없으면 **null 과 미스 기록**.
 *
 * 미적중은 실패가 아니라 정상 경로다 — 그때는 BM25 로만 답한다. 서버에는 모델이 없으므로
 * "없으면 즉석에서 만든다" 는 선택지가 아예 없다.
 */
interface ResolveQueryVectorUseCase {
    /** 스탬프가 다른 항목은 **미적중으로 다룬다** — 다른 벡터 공간의 값을 섞으면 순위가 무의미해진다. */
    fun resolve(rawQuery: String, modelRef: String): List<Float>?
}
