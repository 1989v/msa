package com.kgd.search.domain.attraction.model

/**
 * 이 사이트 근거 정렬 — 찜 수(`sort=saved`) · 14일 고유 클릭 수(`sort=clicked`) 내림차순. 정렬과 함께 **하한을 건다**:
 * 하한 미만·값 없는 문서는 결과에 없다. 하한은 근거 줄과 같은 상수라 「많이 찜한 곳」 목록과 근거 줄이 어긋나지 않는다.
 * 두 정렬은 점수를 버리므로 벡터 레그를 쓰지 않는다(하이브리드 질의에는 정렬을 걸 수 없다).
 */
enum class AttractionSignalSort(val param: String, val min: Int) {
    SAVED("saved", AttractionSaveSignal.SAVED_MIN),
    CLICKED("clicked", AttractionClickSignal.MIN_SAMPLE),
    ;

    companion object {
        fun of(sort: String?): AttractionSignalSort? = entries.firstOrNull { it.param == sort }
    }
}
